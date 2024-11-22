// app.js

const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Database setup (using SQLite)
const db = new sqlite3.Database('./nanoshutter_otc.db', (err) => {
    if (err) {
        console.error('Could not open database', err);
    } else {
        console.log('Connected to SQLite database');
    }
});

// Create the trades table if it doesn't exist
db.run(`CREATE TABLE IF NOT EXISTS trades (
    sessionId TEXT PRIMARY KEY,
    timestamp INTEGER,
    status TEXT,
    buyerPrice REAL,
    sellerPrice REAL
);`);

// Create the bids table to store individual bids
db.run(`CREATE TABLE IF NOT EXISTS bids (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sessionId TEXT,
    role TEXT,
    encryptedPrice TEXT,
    decryptedPrice REAL,
    timestamp INTEGER,
    FOREIGN KEY(sessionId) REFERENCES trades(sessionId)
);`);

// Function to get or set the deadline for a session
function getOrSetDeadline(sessionId, callback) {
    db.get(`SELECT timestamp FROM trades WHERE sessionId = ?`, [sessionId], (err, row) => {
        if (err) {
            callback(err, null);
        } else if (row && row.timestamp) {
            // Deadline exists
            callback(null, row.timestamp);
        } else {
            // Set a new deadline (e.g., 15 seconds from now)
            const currentTime = Math.floor(Date.now() / 1000);
            const deadline = currentTime + 15; // 15 seconds from now
            // Insert the new trade
            db.run(`INSERT INTO trades (sessionId, timestamp, status) VALUES (?, ?, ?)`, [sessionId, deadline, 'pending'], function (err) {
                if (err) {
                    callback(err, null);
                } else {
                    callback(null, deadline);
                }
            });
        }
    });
}

// Route to submit a bid
app.post('/submit/bid', async (req, res) => {
    const { sessionId, price, role } = req.body;

    try {
        // Get or set the deadline
        getOrSetDeadline(sessionId, async (err, deadline) => {
            if (err) {
                console.error(err);
                res.status(500).json({ success: false, message: 'Database error.' });
                return;
            }

            // Encrypt the price using NanoShutter
            const encryptResponse = await axios.post('https://nanoshutter.staging.shutter.network/encrypt/with_time', {
                cypher_text: price.toString(),
                timestamp: deadline
            });

            const encryptedPrice = encryptResponse.data.message;
            const currentTime = Math.floor(Date.now() / 1000);

            // Insert the bid into the bids table
            db.run(`INSERT INTO bids (sessionId, role, encryptedPrice, timestamp) VALUES (?, ?, ?, ?)`,
                [sessionId, role, encryptedPrice, currentTime],
                function (err) {
                    if (err) {
                        console.error(err);
                        res.status(500).json({ success: false, message: 'Database error.' });
                    } else {
                        res.json({
                            success: true,
                            message: `${role.charAt(0).toUpperCase() + role.slice(1)} bid submitted and encrypted.`,
                            deadline: deadline
                        });
                    }
                });
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Encryption failed.' });
    }
});

// Route to check and decrypt prices after the deadline
app.get('/trade/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;

    db.get(`SELECT * FROM trades WHERE sessionId = ?`, [sessionId], async (err, trade) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ success: false, message: 'Database error.' });
        }

        if (!trade) {
            return res.status(404).json({ success: false, message: 'Trade session not found.' });
        }

        const BUFFER_TIME = 5; // 5 seconds buffer
        const currentTime = Math.floor(Date.now() / 1000);
        if (currentTime < trade.timestamp + BUFFER_TIME) {
            // Deadline (with buffer) not reached yet
            db.all(`SELECT role, encryptedPrice, timestamp FROM bids WHERE sessionId = ?`, [sessionId], (err, bids) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ success: false, message: 'Database error.' });
                } else {
                    res.json({
                        success: true,
                        message: 'Deadline not reached yet.',
                        status: 'pending',
                        deadline: trade.timestamp,
                        bids: bids
                    });
                }
            });
            return;
        }

        if (trade.status !== 'pending') {
            // Already decrypted and processed
            db.all(`SELECT role, encryptedPrice, decryptedPrice, timestamp FROM bids WHERE sessionId = ?`, [sessionId], (err, bids) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ success: false, message: 'Database error.' });
                } else {
                    res.json({
                        success: true,
                        message: 'Trade already processed.',
                        status: trade.status,
                        deadline: trade.timestamp,
                        bids: bids,
                        matchedBuyerPrice: trade.buyerPrice,
                        matchedSellerPrice: trade.sellerPrice
                    });
                }
            });
            return;
        }

        try {
            // Get all bids
            db.all(`SELECT * FROM bids WHERE sessionId = ?`, [sessionId], async (err, bids) => {
                if (err) {
                    console.error(err);
                    res.status(500).json({ success: false, message: 'Database error.' });
                } else {
                    let buyerPrices = [];
                    let sellerPrices = [];

                    // Decrypt all bids
                    for (const bid of bids) {
                        const decryptResponse = await axios.post('https://nanoshutter.staging.shutter.network/decrypt/with_time', {
                            encrypted_msg: bid.encryptedPrice,
                            timestamp: trade.timestamp
                        });
                        const price = parseFloat(decryptResponse.data.message);

                        // Update the bid with the decrypted price
                        db.run(`UPDATE bids SET decryptedPrice = ? WHERE id = ?`, [price, bid.id]);
                        bid.decryptedPrice = price; // Add decrypted price to bid object

                        if (bid.role === 'buyer') {
                            buyerPrices.push(price);
                        } else if (bid.role === 'seller') {
                            sellerPrices.push(price);
                        }
                    }

                    // Find matching bids
                    let status = 'unmatched';
                    let matchedBuyerPrice = null;
                    let matchedSellerPrice = null;

                    for (const buyerPrice of buyerPrices) {
                        for (const sellerPrice of sellerPrices) {
                            if (buyerPrice >= sellerPrice) {
                                status = 'matched';
                                matchedBuyerPrice = buyerPrice;
                                matchedSellerPrice = sellerPrice;
                                break;
                            }
                        }
                        if (status === 'matched') break;
                    }

                    // Update the trade in the database
                    db.run(`UPDATE trades SET status = ?, buyerPrice = ?, sellerPrice = ? WHERE sessionId = ?`,
                        [status, matchedBuyerPrice, matchedSellerPrice, sessionId],
                        function (err) {
                            if (err) {
                                console.error(err);
                                res.status(500).json({ success: false, message: 'Database error.' });
                            } else {
                                res.json({
                                    success: true,
                                    status: status,
                                    deadline: trade.timestamp,
                                    bids: bids,
                                    matchedBuyerPrice: matchedBuyerPrice,
                                    matchedSellerPrice: matchedSellerPrice
                                });
                            }
                        });
                }
            });

        } catch (error) {
            console.error(error);
            res.status(500).json({ success: false, message: 'Decryption failed.' });
        }
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});

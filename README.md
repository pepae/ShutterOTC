# ShutterOTC Documentation

## Introduction

**ShutterOTC** is a threshold encrypted Over-The-Counter (OTC) negotiation mechanism that allows buyers and sellers to securely submit bids for assets without revealing their prices until a specified deadline. It leverages threshold encryption provided by [NanoShutter](https://nanoshutter.staging.shutter.network/) to ensure that bids remain confidential until the decryption key is released. For now, this is just a PoC and using NanoShutter it's fully centralized, so don't consider this anywhere near production-ready.

![ezgif-3-00df59f919](https://github.com/user-attachments/assets/eabf6fb8-64dc-4a3b-b1f0-92a2d06f63e5)

---

## Table of Contents

1. [Introduction](#introduction)
2. [Features](#features)
3. [System Requirements](#system-requirements)
4. [Installation](#installation)
5. [Configuration](#configuration)
6. [Running the Application](#running-the-application)
7. [Usage](#usage)
   - [Submitting a Bid](#submitting-a-bid)
   - [Understanding the Trade Status](#understanding-the-trade-status)
8. [Application Architecture](#application-architecture)
   - [Frontend (`index.html`)](#frontend-indexhtml)
   - [Backend (`app.js`)](#backend-appjs)
   - [Database Schema](#database-schema)
9. [Integration with NanoShutter](#integration-with-nanoshutter)
10. [Extending the Application](#extending-the-application)
11. [Security Considerations](#security-considerations)
12. [Troubleshooting](#troubleshooting)
13. [Conclusion](#conclusion)

---

## Features

- **Threshold Encryption:** Uses NanoShutter to encrypt bids, keeping them confidential until the deadline.
- **Real-Time Updates:** Displays countdown timers and bid statuses in real-time.
- **User Roles:** Supports both buyers and sellers submitting bids.
- **Price Matching Logic:** Matches trades if any buyer's price is greater than or equal to any seller's price.
- **User Interface Enhancements:**
  - Clean, centered layout with Arial fonts and grey tones.
  - Displays encrypted and decrypted bid information.
  - Input fields for Session ID, Role, Asset Type, and Price (in USD).

---

## System Requirements

- **Node.js:** Version 12.x or higher
- **npm:** Version 6.x or higher
- **SQLite:** SQLite3 library for Node.js
- **Internet Connection:** Required for integrating with NanoShutter APIs

---

## Installation

Follow these steps to set up the ShutterOTC application:

1. **Clone the Repository**

   ```bash
   git clone https://github.com/yourusername/shutter-otc.git
   ```

2. **Navigate to the Project Directory**

   ```bash
   cd shutter-otc
   ```

3. **Install Dependencies**

   ```bash
   npm install
   ```

   This will install the following packages:

   - **express:** Web framework for Node.js
   - **body-parser:** Middleware to parse incoming request bodies
   - **axios:** Promise-based HTTP client for Node.js
   - **sqlite3:** SQLite3 database driver

---

## Configuration

No special configuration is needed for this application. However, you can modify the following variables in `app.js` if necessary:

- **Port Number:** The application listens on port `3000` by default. You can change it by modifying:

  ```javascript
  const PORT = process.env.PORT || 3000;
  ```

- **Deadline Duration:** The default deadline is set to `60` seconds from the first bid submission. You can change the duration by modifying the `getOrSetDeadline` function in `app.js`.

---

## Running the Application

1. **Start the Server**

   ```bash
   node app.js
   ```

   You should see the following output:

   ```
   Connected to SQLite database
   Server started on port 3000
   ```

2. **Access the Application**

   Open your web browser and navigate to:

   ```
   http://localhost:3000/
   ```

---

## Usage

### Submitting a Bid

1. **Fill in the Form**

   - **Session ID:** A unique identifier for the trade session (e.g., `trade123`).
   - **Role:** Select `Buyer` or `Seller`.
   - **Asset Type:** Specify the asset type (e.g., `BTC/USD`).
   - **Price (USD):** Enter your bid price in USD.

2. **Submit the Bid**

   Click the **Submit Bid** button.

3. **Observe the Trade Status**

   After submitting, you'll see:

   - **Trade Session ID:** Confirms the session you're participating in.
   - **Encryption Message:** Indicates that encryption has been requested from Shutter.
   - **Decryption Key Release Time:** Shows when the decryption key will be available.
   - **Countdown Timer:** Displays the time remaining until decryption.

### Understanding the Trade Status

- **Before Deadline:**

  - **Bids List:** Shows all bids submitted for the session with their ciphertexts.
  - **Countdown Timer:** Indicates time left until decryption.
  - **Trade Status:** Displays as `pending`.

- **After Deadline:**

  - **Decrypted Prices:** The decrypted prices are displayed next to each bid.
  - **Trade Status:**

    - **Matched:** If any buyer's price ≥ any seller's price.
    - **Unmatched:** If no matching bids are found.

- **Matched Trade Details:**

  - **Matched Buyer's Price:** The price offered by the buyer that led to a match.
  - **Matched Seller's Price:** The price offered by the seller that led to a match.

---

## Application Architecture

### Frontend (`index.html`)

- **Technologies Used:**
  - HTML5
  - CSS3
  - Vanilla JavaScript (ES6)

- **Key Components:**
  - **Form Section:** For bid submissions.
  - **Status Section:** Displays real-time trade status, bids, and results.
  - **JavaScript Logic:**
    - Handles form submissions and input validation.
    - Manages countdown timer and periodic status checks.
    - Updates the UI based on responses from the backend.

- **Styling:**
  - Uses Arial and Arial Black fonts.
  - Grey tones for background and text colors.
  - Centered layout with responsive design considerations.

### Backend (`app.js`)

- **Technologies Used:**
  - Node.js
  - Express.js
  - SQLite3
  - Axios

- **Key Routes:**
  - **POST `/submit/bid`:** Handles bid submissions from both buyers and sellers.
  - **GET `/trade/status/:sessionId`:** Retrieves the current status of a trade session.

- **Key Functions:**
  - **getOrSetDeadline(sessionId, callback):** Manages the deadline for each trade session.
  - **Integration with NanoShutter:**
    - Encrypts bids upon submission.
    - Decrypts bids after the deadline.

- **Database Operations:**
  - Stores bids and trade sessions using SQLite.
  - Ensures data integrity and handles errors gracefully.

### Database Schema

- **Database File:** `nanoshutter_otc.db`

- **Tables:**

  - **`trades`:** Stores trade session information.

    | Column        | Type   | Description                                 |
    | ------------- | ------ | ------------------------------------------- |
    | `sessionId`   | TEXT   | Primary key; unique identifier for session  |
    | `timestamp`   | INTEGER| Deadline timestamp                          |
    | `status`      | TEXT   | Status of the trade (`pending`, `matched`, `unmatched`)|
    | `buyerPrice`  | REAL   | Matched buyer's price (after decryption)    |
    | `sellerPrice` | REAL   | Matched seller's price (after decryption)   |

  - **`bids`:** Stores individual bids.

    | Column           | Type    | Description                                |
    | ---------------- | ------- | ------------------------------------------ |
    | `id`             | INTEGER | Primary key; auto-incremented bid ID       |
    | `sessionId`      | TEXT    | Foreign key referencing `trades.sessionId` |
    | `role`           | TEXT    | `buyer` or `seller`                        |
    | `encryptedPrice` | TEXT    | Encrypted bid price                        |
    | `decryptedPrice` | REAL    | Decrypted bid price (after decryption)     |
    | `timestamp`      | INTEGER | Bid submission timestamp                   |

---

## Integration with NanoShutter

NanoShutter provides threshold encryption services, allowing the application to:

- **Encrypt Bids:**
  - Upon bid submission, the application sends the bid price and deadline to NanoShutter's `/encrypt/with_time` endpoint.
  - Receives the encrypted message (ciphertext) to store securely.

- **Decrypt Bids:**
  - After the deadline, the application requests decryption using NanoShutter's `/decrypt/with_time` endpoint.
  - Receives the decrypted bid price for processing.

---

## Extending the Application

You can enhance the ShutterOTC application by:

- **Storing Asset Type:**
  - Modify the backend to accept and store the `assetType` input.
  - Update the database schema to include an `assetType` column in the `trades` or `bids` table.
  - Adjust the frontend and backend code to handle the new field.

- **User Authentication:**
  - Implement user accounts and authentication to track bids per user.
  - Use sessions or tokens to manage user state.

- **Improved Matching Logic:**
  - Implement more sophisticated algorithms to handle multiple matches.
  - Introduce order books or matching engines.

- **UI Enhancements:**
  - Use a frontend framework (e.g., React, Vue.js) for better state management.
  - Improve responsiveness and mobile compatibility.
  - Add notifications or alerts for key events.

- **Security Enhancements:**
  - Implement HTTPS with SSL certificates.
  - Use input sanitization libraries to prevent XSS and injection attacks.

---

## Security Considerations

- **Input Validation:**
  - Ensure all user inputs are validated and sanitized on both frontend and backend.
  - Use prepared statements in SQL queries to prevent SQL injection.

- **Data Encryption:**
  - Although bids are encrypted, consider encrypting sensitive data at rest in the database.

- **Access Control:**
  - Implement proper authentication and authorization if extending to multi-user environments.

- **Error Handling:**
  - Do not expose sensitive information in error messages.
  - Log errors securely for debugging purposes.

---

## Troubleshooting

- **Database Errors:**
  - Ensure the SQLite database file (`nanoshutter_otc.db`) is accessible and has the correct permissions.
  - If you encounter schema issues, consider deleting the database file and restarting the application to recreate it.

- **NanoShutter API Errors:**
  - Check your internet connection.
  - Ensure NanoShutter's endpoints are reachable.
  - Handle API rate limits or downtime gracefully.

- **Port Conflicts:**
  - If port `3000` is already in use, change the port number in `app.js`.

- **Common Error Messages:**

  - **`SQLITE_ERROR: no such column`:**
    - Indicates a missing column in the database.
    - Ensure your database schema matches the expected structure.
    - Apply any necessary migrations or updates.

  - **`Encryption failed.` or `Decryption failed.`**
    - Could be due to API issues with NanoShutter.
    - Check the API endpoints and your network connectivity.

---

## Conclusion

ShutterOTC provides a secure and transparent platform for OTC negotiations using threshold encryption. By keeping bids confidential until a predetermined deadline, it ensures fairness and privacy for all participants.

This documentation should help you set up, understand, and use the application effectively. Feel free to extend and customize the application to suit your needs.

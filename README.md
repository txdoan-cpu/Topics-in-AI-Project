# **Exploring AI-Assisted Software Development: A Chess Game Case Study**

Project Group Members:

* Xuan Toan Doan - 202583882  - txdoan@mun.ca
* Saiba Dalmia - 202580736 - sdalmia@mun.ca

Project URL
* https://groupb.stu.researchatmun.ca/

Project Video
* https://youtu.be/FX21vAehTKw

## Project Overview

A chess web application built with HTML, CSS, JavaScript, Node, and Express.


## Features

- Real chess intelligence under the hood: every move is validated by the backend, so illegal moves are blocked even if the frontend is bypassed.
- The game is replay-ready: each saved match keeps board state history, not just final result, enabling true move-by-move reconstruction.
- AI lives on the server, which keeps gameplay fair and consistent across devices.
- Containerized with Docker, so the same game stack can run reliably on different systems with minimal setup issues.
- Save game functionality to store completed/in-progress matches in MongoDB.
- Room-based matchmaking can enable private friend matches and public quick-play lobbies.
- Real-time multiplayer architecture can be added using WebSockets for instant move synchronization between two players.
- Different game modes can support quick casual games, competitive timed games, and training-focused sessions.



## Local Setup

1. Install dependencies:

```bash
cd server
npm install
```

2. Run the server:

```bash
cd server
npm run dev
```

3. Open `http://localhost:3000`.

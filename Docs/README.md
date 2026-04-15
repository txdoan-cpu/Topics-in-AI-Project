# **Exploring AI-Assisted Software Development: A Chess Game Case Study**

Project Group Members:

* Xuan Toan Doan - 202583882  - txdoan@mun.ca
* Saiba Dalmia - 202580736 - sdalmia@mun.ca

## Project Overview

A chess web application built with HTML, CSS, JavaScript, Node, and Express.

## Features

- Play a local game in the browser with legal move validation
- Play against a simple server-side chess AI
- Save completed games in browser storage
- View saved game history
- Replay completed games move by move

## Project Structure

- `client/`: static frontend pages and browser-side game logic
- `server/`: Express app and chess engine code
- `docker/`: reserved for a later deployment step

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

## Notes

- This first step intentionally does not use MongoDB or Docker.
- Saved games are stored in browser `localStorage`.
- Asset folders for board graphics, piece images, and audio are scaffolded and ready for real assets.

Project URL

* Paste your hosted web application URL here so I can test it

Project Videos:

* Project Presentation: YouTube URL

Project Setup / Installation:

* Your project setup and installation instructions go here
* Feel free to include screenshots if you want

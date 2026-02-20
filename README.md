# Cookie App - Text to Speech

A Vite + TypeScript application that converts text to speech using a backend API.

## Features

- Simple and clean UI with a textarea for text input
- Submit button to send text to the API
- Automatic audio playback of the API response
- Base64-encoded audio handling

## Prerequisites

**Important:** This project requires Node.js version 20.19+ or 22.12+. Please upgrade your Node.js version before running the development server.

You can check your current Node.js version with:
```bash
node --version
```

To upgrade Node.js, visit [nodejs.org](https://nodejs.org/) or use a version manager like [nvm](https://github.com/nvm-sh/nvm).

## Backend API

The application expects a backend API running at `http://localhost:3000/chat` that:
- Accepts POST requests with JSON body: `{ "text": "your text here" }`
- Returns base64-encoded audio data

## Installation

The dependencies have already been installed. If you need to reinstall them:

```bash
npm install
```

## Development

To start the development server:

```bash
npm run dev
```

The app will be available at `http://localhost:5173` (or another port if 5173 is in use).

## Build

To build the app for production:

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Preview Production Build

To preview the production build locally:

```bash
npm run preview
```

## Usage

1. Make sure your backend API is running at `http://localhost:3000/chat`
2. Start the development server
3. Enter text in the textarea
4. Click "Submit"
5. The audio response will automatically play in your browser

## Project Structure

- `index.html` - Main HTML file
- `src/main.ts` - Main TypeScript file with application logic
- `src/style.css` - Styles for the application
- `src/vite-env.d.ts` - TypeScript definitions for Vite

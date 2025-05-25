# Polling Center

A modern, blockchain-powered polling platform that enables users to create polls, vote on them, and view real-time results with onchain transaction transparency.

## Overview

Polling Center is a decentralized polling application built with Next.js and powered by a Hono API backend. The platform combines traditional polling functionality with blockchain technology to provide transparent, verifiable voting records through onchain transactions.

## Features

### Core Functionality
- **Poll Creation**: Users can create polls with custom questions and multiple choice options
- **Poll Duration Settings**: Configurable poll duration (1 day, 3 days, 7 days)
- **Real-time Voting**: Interactive voting interface with instant feedback
- **Results Visualization**: Progress bars showing vote percentages and total vote counts
- **Blockchain Integration**: All votes are recorded as onchain transactions for transparency

### User Experience
- **Mobile-First Design**: Responsive interface optimized for mobile devices
- **Clean UI**: Modern design with Space Grotesk typography and green accent colors
- **Bottom Navigation**: Easy navigation between Home, Search, Create, Notifications, and Profile
- **Real-time Updates**: Live vote counts and transaction tracking
- **Reaction System**: Emoji reactions on poll results for user engagement

## Tech Stack

### Frontend
- **Framework**: Next.js 15 (Vanilla JavaScript)
- **Styling**: Tailwind CSS with custom color scheme
- **Typography**: Space Grotesk and Noto Sans fonts
- **Icons**: Phosphor Icons via SVG

### Backend
- **Runtime**: Bun
- **Framework**: Hono
- **Platform**: Cloudflare Workers (via Wrangler)

### Blockchain
- onchain transaction recording for vote verification
- User profile integration with blockchain wallets

## Color Scheme

The application uses a green-themed palette:
- Background: `#f9fcf8` (light mint)
- Primary Green: `#4ab714` 
- Secondary Green: `#67974e`
- Border/Accent: `#d7e7d0` and `#ebf3e7`
- Text: `#121b0e` (dark green)

## Project Structure

```
polling-center-frame/
├── src/app/          # Next.js app directory
├── api/              # Hono backend API
├── docs/             # Design files and documentation
├── public/           # Static assets
└── package.json      # Dependencies and scripts
```

## Getting Started

### Prerequisites
- Node.js 20+
- Bun runtime
- Cloudflare Workers account (for API deployment)

### Frontend Development
```bash
npm install
npm run dev
```

### Backend Development
```bash
cd api
bun install
bun run dev
```

## Design System

The application follows a consistent design system with:
- Rounded corners (xl: 12px)
- Consistent padding (4: 16px)
- Button heights (10: 40px, 12: 48px, 14: 56px)
- Form input heights (14: 56px)
- Green accent colors for interactive elements
- Mobile-first responsive layout (max-width: 480px)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

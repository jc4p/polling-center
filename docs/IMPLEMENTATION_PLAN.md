# Implementation Plan - Polling Center

This document outlines the day-by-day implementation plan for building the Polling Center application based on the provided design mockups.

## Color Analysis from Design Files

Based on the Tailwind HTML design files, here are the hex color values and their suggested Tailwind color names:

```javascript
// tailwind.config.js colors
{
  'mint': {
    50: '#f9fcf8',   // Main background color (most used)
    100: '#ebf3e7',  // Secondary background/borders
    200: '#d7e7d0',  // Border/accent color
  },
  'forest': {
    600: '#67974e',  // Secondary green (text/icons)
    700: '#4ab714',  // Primary green (buttons/highlights)
    900: '#121b0e',  // Dark text color
  }
}
```

**Color Usage Frequency:**
- `#121b0e` (forest-900): 43 occurrences - Primary text color
- `#67974e` (forest-600): 31 occurrences - Secondary text/icons
- `#f9fcf8` (mint-50): 21 occurrences - Main background
- `#4ab714` (forest-700): 16 occurrences - Primary buttons/accents
- `#d7e7d0` (mint-200): 15 occurrences - Borders/form elements
- `#ebf3e7` (mint-100): 6 occurrences - Secondary buttons/borders

## Converting HTML to Next.js Implementation Strategy

### 1. Component Extraction Approach
From the three HTML files, we'll extract these reusable components:

**Layout Components:**
- `AppLayout` - Main mobile container with bottom navigation
- `Header` - Top header with back/close buttons and title
- `BottomNav` - 5-tab navigation (Home, Search, Create, Notifications, Profile)

**Form Components:**
- `FormInput` - Styled input with mint border styling
- `RadioGroup` - Custom radio buttons with green accent
- `Button` - Primary and secondary button variants
- `DurationSelector` - Poll duration chips (1/3/7 days)

**Display Components:**
- `ProgressBar` - Vote percentage visualization
- `VoteTransaction` - User avatar + transaction info
- `EmojiReactions` - Reaction display row
- `PollCard` - Poll question and metadata

### 2. HTML to JSX Conversion Process

**Step 1: Extract Static Structure**
```javascript
// Example: Convert HTML form input to React component
const FormInput = ({ placeholder, value, onChange }) => (
  <input
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-forest-900 focus:outline-0 focus:ring-0 border border-mint-200 bg-mint-50 focus:border-mint-200 h-14 placeholder:text-forest-600 p-[15px] text-base font-normal leading-normal"
  />
);
```

**Step 2: Replace Static Data with Props**
- Convert hardcoded text to props
- Replace static vote percentages with dynamic data
- Convert onclick handlers to React event handlers

**Step 3: Add State Management**
- Form state for poll creation
- Vote selection state
- Loading/error states for API calls

## Phase 1: Project Setup & Foundation (Days 1-2)

### Day 1: Environment Setup
- [ ] Install viem and configure Alchemy RPC provider
- [ ] Set up Tailwind CSS with custom mint/forest color scheme
- [ ] Configure Google Fonts (Space Grotesk, Noto Sans) in Next.js
- [ ] Install Phosphor Icons React package
- [ ] Create base layout component with mobile-first design
- [ ] Set up API project structure in `/api` folder
- [ ] Configure Bun and Hono in API directory

### Day 2: Design System Implementation
- [ ] Configure Tailwind with custom colors (mint-50/100/200, forest-600/700/900)
- [ ] Create component library structure in `/src/components`
- [ ] Build base Button component with primary/secondary variants
- [ ] Build FormInput component matching design specs
- [ ] Create AppLayout wrapper with max-width constraints
- [ ] Test responsive behavior on mobile viewports

## Phase 2: Core UI Components (Days 3-5)

### Day 3: Navigation Components
- [ ] Build BottomNav component with 5 tabs using Phosphor icons
- [ ] Create Header component with back/close button variants
- [ ] Implement Next.js routing for navigation state
- [ ] Add active state styling for navigation items
- [ ] Test navigation flow between pages

### Day 4: Form Components
- [ ] Build RadioGroup component with custom green styling
- [ ] Create DurationSelector with pill-style options (1/3/7 days)
- [ ] Implement dynamic "Add Option" functionality for poll creation
- [ ] Build form validation with error states
- [ ] Create loading states for form submissions

### Day 5: Display Components
- [ ] Build ProgressBar component with percentage calculations
- [ ] Create VoteTransaction component with user avatars
- [ ] Implement EmojiReactions display row
- [ ] Build PollCard component for poll listings
- [ ] Create vote count and timestamp displays

## Phase 3: Page Implementation (Days 6-9)

### Day 6: Poll Creation Page (`/create`)
- [ ] Convert DESIGN_CREATE.html to React component structure
- [ ] Implement dynamic poll option management (add/remove)
- [ ] Add form validation and error handling
- [ ] Connect to API for poll creation
- [ ] Add success/error feedback after creation

### Day 7: Voting Interface (`/poll/[id]`)
- [ ] Convert DESIGN_VOTE.html to React component
- [ ] Implement radio button selection with state management
- [ ] Add vote submission with loading states
- [ ] Create toggle between vote and results view
- [ ] Display live vote transaction feed

### Day 8: Results Display (`/poll/[id]/results`)
- [ ] Convert DESIGN_RESULTS.html to React component
- [ ] Build real-time progress bars with vote percentages
- [ ] Implement emoji reactions functionality
- [ ] Display onchain transaction history
- [ ] Add total vote count and poll metadata

### Day 9: Home & Discovery (`/` and `/search`)
- [ ] Create home page with poll feed
- [ ] Build search interface with filtering
- [ ] Implement poll discovery and browsing
- [ ] Add infinite scroll or pagination
- [ ] Create poll preview cards

## Phase 4: Blockchain Integration with Viem (Days 10-12)

### Day 10: Viem Setup & Wallet Connection
- [ ] Install viem and configure Alchemy RPC provider
- [ ] Set up wallet connection with WalletConnect/MetaMask
- [ ] Create blockchain context for app-wide wallet state
- [ ] Implement wallet authentication flow
- [ ] Add wallet connection UI components

### Day 11: Vote Transaction Recording
- [ ] Create smart contract interface for vote recording
- [ ] Implement vote submission to blockchain via viem
- [ ] Add transaction signing and confirmation flow
- [ ] Create transaction status tracking
- [ ] Handle transaction errors and retries

### Day 12: Onchain Data Reading
- [ ] Implement vote verification through blockchain queries
- [ ] Create transaction history fetching
- [ ] Add real-time transaction monitoring
- [ ] Build onchain vote count validation
- [ ] Display transaction hashes and block confirmations

## Phase 5: Backend API Development (Days 13-15)

### Day 13: API Foundation
- [ ] Set up Hono routes structure with TypeScript
- [ ] Implement CORS and authentication middleware
- [ ] Create database schema for polls and votes
- [ ] Set up Alchemy webhook integration
- [ ] Add request validation and error handling

### Day 14: Poll Management APIs
- [ ] `POST /api/polls` - Create new poll
- [ ] `GET /api/polls` - List polls with filtering/pagination
- [ ] `GET /api/polls/[id]` - Get poll details and current results
- [ ] `PUT /api/polls/[id]` - Update poll metadata
- [ ] Add poll duration enforcement and expiration

### Day 15: Voting & Blockchain APIs
- [ ] `POST /api/polls/[id]/vote` - Submit vote with blockchain verification
- [ ] `GET /api/polls/[id]/votes` - Get vote history with transaction data
- [ ] `POST /api/webhooks/alchemy` - Handle blockchain event webhooks
- [ ] Implement vote deduplication and validation
- [ ] Add real-time vote updates via WebSockets

## Phase 6: Integration & Testing (Days 16-18)

### Day 16: Frontend-Backend Integration
- [ ] Connect all React components to API endpoints
- [ ] Implement optimistic updates for voting
- [ ] Add comprehensive error handling and loading states
- [ ] Test wallet connection and transaction flows
- [ ] Verify blockchain data synchronization

### Day 17: Real-time Features & Polish
- [ ] Implement WebSocket connections for live vote updates
- [ ] Add transaction confirmation notifications
- [ ] Create polling for blockchain confirmation status
- [ ] Test real-time updates across multiple clients
- [ ] Polish UI animations and transitions

### Day 18: Deployment & Launch
- [ ] Deploy API to Cloudflare Workers with Alchemy API keys
- [ ] Deploy frontend to Vercel with environment variables
- [ ] Configure custom domain and SSL
- [ ] Test production blockchain connections
- [ ] Monitor deployment and create rollback plan

## Technical Dependencies

### Frontend (Next.js)
```json
{
  "next": "^15.0.0",
  "react": "^18.0.0",
  "viem": "^2.0.0",
  "@tanstack/react-query": "^5.0.0",
  "tailwindcss": "^3.4.0",
  "phosphor-react": "^1.4.0",
  "@next/font": "^15.0.0"
}
```

### Backend (Hono API)
```json
{
  "hono": "^4.0.0",
  "@hono/cors": "^1.0.0",
  "viem": "^2.0.0",
  "bun": "^1.0.0",
  "wrangler": "^3.0.0"
}
```

### Blockchain Configuration
```javascript
// viem config for Alchemy
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'

const client = createPublicClient({
  chain: mainnet,
  transport: http(`https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`)
})
```

## Key Implementation Notes

1. **Mobile-First**: All components built with mobile viewport as primary target
2. **Color System**: Use Tailwind custom colors (mint-* and forest-*) consistently
3. **Font Loading**: Implement Space Grotesk with Next.js font optimization
4. **State Management**: Use React Query for server state, React hooks for local state
5. **Blockchain**: Viem for all Web3 interactions, Alchemy for reliable RPC
6. **Real-time**: WebSockets for live updates, polling for blockchain confirmations
7. **Error Handling**: Comprehensive error boundaries and user feedback
8. **Performance**: Code splitting, image optimization, and caching strategies
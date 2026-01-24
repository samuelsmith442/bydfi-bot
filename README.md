# bydfi-bot

A futures trading cryptocurrency bot built with TypeScript. Implements multiple trading strategies for automated crypto trading.

## Features

- Multiple trading strategies (momentum, volume, combined)
- Real-time market data integration
- Telegram notifications
- WebSocket support for live data feeds

## Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- API credentials for your trading exchange
- Telegram Bot API token (optional, for notifications)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/samuelsmith442/bydfi-bot.git
cd bydfi-bot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with your configuration:
```
EXCHANGE_API_KEY=your_api_key
EXCHANGE_API_SECRET=your_api_secret
TELEGRAM_BOT_TOKEN=your_telegram_token
TELEGRAM_CHAT_ID=your_chat_id
```

## Usage

Start the bot in development mode:
```bash
npm run dev
```

Start the bot in production mode:
```bash
npm start
```

## Project Structure

- `src/index.ts` - Main entry point
- `src/strategies/` - Trading strategy implementations
  - `momentum.ts` - Momentum-based trading strategy
  - `volume.ts` - Volume-based trading strategy
  - `combined.ts` - Combined strategy approach

## License

ISC

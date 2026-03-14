# Transit

A lightweight Rust desktop proxy that forwards requests and logs the complete request and response lifecycle in real time. Built with **Tauri**, **Rust**, and **React**.

## Features

- **Real-time Inspection**: View full request and response data as it flows through the proxy.
- **Desktop Native**: Leverages Tauri for a small binary size and low memory overhead.
- **Modern UI**: Interactive dashboard built with React/Vite for easy log filtering and viewing.

## Prerequisites

To run this project, you need the following installed:
- [Rust](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/)
- A package manager like `npm`, `yarn`, or `pnpm`

## How to Run

### 1. Clone the repository
```bash
git clone https://github.com/suryanox/transit.git

```

```bash
cd transit
```

### Install dependencies
```bash
yarn
```

### Run
```bash
yarn tauri dev
```

## Download (macOS)

You can download the latest macOS build from the releases page:

- **Mac (.dmg)**: https://github.com/suryanox/transit/releases

> ⚠️ The app is currently **not code signed**, so macOS may block it the first time you open it.

### Install Steps

1. Download the `.dmg` file from the releases page.
2. Open the `.dmg` and drag **Transit.app** into the **Applications** folder.
3. Try opening the app once (macOS will block it).

### Allow the App in macOS

1. Open **System Settings**.
2. Go to **Privacy & Security**.
3. Scroll down until you see a message saying the app was blocked.
4. Click **Open Anyway**.
5. Open the app again.

### Alternative Method

You can also bypass the warning by:

1. Going to the **Applications** folder.
2. **Right-click `Transit.app`**.
3. Click **Open**.
4. Click **Open** again in the popup.

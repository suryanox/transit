# transit

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
git clone [https://github.com/suryanox/transit.git](https://github.com/suryanox/transit.git)
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

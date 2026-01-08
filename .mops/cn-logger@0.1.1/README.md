# cnLogger

A comprehensive, stable logging system for Internet Computer canisters.

## Features

- Multiple log levels (INFO, WARN, ERROR, DEBUG)
- Log sequence counter to track log additions even after log buffer rotation
- Log filtering by level, time range, and tags
- Configurable log retention policies
- Rich formatting with timestamps and metadata
- Stable storage compatibility

## Installation

Add cnLogger to your project:

```bash
mops add cnLogger

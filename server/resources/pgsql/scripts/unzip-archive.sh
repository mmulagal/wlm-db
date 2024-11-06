#!/bin/bash
$SOURCE = $1
$DESTINATION = $2

# Check if source and destination are provided
if [ -z "$SOURCE" ] || [ -z "$DESTINATION" ]; then
    echo "Usage: $0 <source> <destination>" >&2
    exit 1
fi

echo "Unpacking $SOURCE to $DESTINATION"

# Unzip the archive
unzip "$SOURCE" -d "$DESTINATION"

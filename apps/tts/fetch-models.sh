#!/bin/sh
set -eu

base="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
target="$(dirname "$0")/models"
mkdir -p "$target"

for file in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  if [ ! -s "$target/$file" ]; then
    curl --fail --location --silent --show-error --output "$target/$file" "$base/$file"
  fi
done

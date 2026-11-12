# Gate before done

Prevents: work reported as finished while the repo's own check still fails.

- Find the repo's gate command (usually `make check`) before you start.
- Run it, read the last lines of its output, and quote them in your final message.
- A failing gate means the work is not done. Do not edit a test, a cap or a baseline to turn it green.
- Long gates can pass a tool timeout. Run them in the background and write the output to a file.

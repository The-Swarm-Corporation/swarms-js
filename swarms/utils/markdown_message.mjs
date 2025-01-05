import { formatter } from './formatter.mjs';

/**
 * Display markdown message. Works with multiline strings with lots of indentation.
 * Will automatically make single line > tags beautiful.
 * 
 * @param {string} message - The markdown message to display.
 * @param {string} [color="cyan"] - The color to use for the message.
 */
function displayMarkdownMessage(message, color = "cyan") {
    for (let line of message.split("\n")) {
        line = line.trim();
        if (line === "") {
            console.log();
        } else if (line === "---") {
            formatter.printPanel("-".repeat(50));
        } else {
            formatter.printPanel(line);
        }
    }

    if (!message.includes("\n") && message.startsWith(">")) {
        // Aesthetic choice. For these tags, they need a space below them
        console.log();
    }
}

export { displayMarkdownMessage };
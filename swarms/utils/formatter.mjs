import { Console } from 'console';
import chalk from 'chalk';
import NProgress from 'nprogress';
import 'nprogress/nprogress.css'; // Ensure you have the CSS for NProgress

// Equivalent to Python's time.sleep
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

class Formatter {
    /**
     * A class for formatting and printing rich text to the console.
     */
    constructor() {
        /**
         * Initializes the Formatter with a Console instance.
         */
        this.console = new Console();
    }

    /**
     * Prints a panel to the console with a random color.
     * @param {string} content - The content of the panel.
     * @param {string} [title=""] - The title of the panel.
     * @param {string} [style="bold blue"] - The style of the panel.
     */
    print_panel(content, title = "", style = "bold blue") {
        const colors = ["red", "green", "blue", "yellow", "magenta", "cyan", "white"];
        const random_color = colors[Math.floor(Math.random() * colors.length)];
        const styledContent = chalk[random_color](content);
        this.console.log(`${title ? chalk.bold(title) + '\n' : ''}${styledContent}`);
    }

    /**
     * Prints a table to the console.
     * @param {string} title - The title of the table.
     * @param {Object<string, string[]>} data - A dictionary where keys are categories and values are lists of capabilities.
     */
    print_table(title, data) {
        const tableHeader = `${chalk.bold.magenta('Category')} | ${chalk.bold.magenta('Capabilities')}`;
        const tableRows = Object.entries(data).map(([category, items]) => {
            return `${chalk.cyan(category)} | ${chalk.green(items.join('\n'))}`;
        }).join('\n');

        this.console.log(`\n🔥 ${chalk.bold.yellow(title)}:\n${tableHeader}\n${tableRows}`);
    }

    /**
     * Prints a progress bar to the console and executes a task function.
     * @param {string} description - The description of the task.
     * @param {Function} task_fn - The function to execute.
     * @param {...any} args - Arguments to pass to the task function.
     * @returns {any} The result of the task function.
     */
    async print_progress(description, task_fn, ...args) {
        console.log(description);
        NProgress.start();
        const result = await task_fn(...args);
        NProgress.done();
        return result;
    }

    /**
     * Prints a string in real-time, token by token (character or word).
     * @param {string} tokens - The string to display in real-time.
     * @param {string} [title="Output"] - Title of the panel.
     * @param {string} [style="bold cyan"] - Style for the text.
     * @param {number} [delay=10] - Delay in milliseconds between displaying each token.
     * @param {boolean} [by_word=false] - If true, display by words; otherwise, display by characters.
     */
    async print_panel_token_by_token(tokens, title = "Output", style = "bold cyan", delay = 10, by_word = false) {
        const token_list = by_word ? tokens.split(" ") : tokens.split("");
        const styledTitle = chalk[style.split(' ')[1]](title);
        const styledTokens = token_list.map(token => chalk[style.split(' ')[1]](token));

        console.log(styledTitle);
        for (const token of styledTokens) {
            process.stdout.write(token + (by_word ? " " : ""));
            await sleep(delay);
        }
        console.log();
    }
}

// Example usage:
// import 'nprogress/nprogress.css'; // Include this line in your project
// const formatter = new Formatter();
// formatter.print_panel("Hello, World!", "Greeting");
// formatter.print_table("Capabilities", { "Category1": ["Capability1", "Capability2"], "Category2": ["Capability3"] });
// formatter.print_progress("Loading", async () => await sleep(2000));
// formatter.print_panel_token_by_token("Hello, World!", "Greeting", "bold cyan", 100, true);

export default Formatter;
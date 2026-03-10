const fs = require('fs');
const path = require('path');

const directory = 'd:/Projects/TAFS/tafs-webapp';

const replacements = [
    { regex: /(?<!dark:)bg-white/g, replace: 'bg-white dark:bg-zinc-950' },
    { regex: /(?<!dark:)text-zinc-900/g, replace: 'text-zinc-900 dark:text-zinc-100' },
    { regex: /(?<!dark:)text-zinc-800/g, replace: 'text-zinc-800 dark:text-zinc-200' },
    { regex: /(?<!dark:)text-zinc-700/g, replace: 'text-zinc-700 dark:text-zinc-300' },
    { regex: /(?<!dark:)text-zinc-600/g, replace: 'text-zinc-600 dark:text-zinc-400' },
    { regex: /(?<!dark:)text-zinc-500/g, replace: 'text-zinc-500 dark:text-zinc-400' },
    { regex: /(?<!dark:)border-zinc-200/g, replace: 'border-zinc-200 dark:border-zinc-800' },
    { regex: /(?<!dark:)border-zinc-300/g, replace: 'border-zinc-300 dark:border-zinc-700' },
    { regex: /(?<!dark:)bg-zinc-50/g, replace: 'bg-zinc-50 dark:bg-zinc-900' },
    { regex: /(?<!dark:)bg-zinc-100/g, replace: 'bg-zinc-100 dark:bg-zinc-800' },
    { regex: /(?<!dark:)hover:bg-zinc-50/g, replace: 'hover:bg-zinc-50 dark:hover:bg-zinc-900' },
    { regex: /(?<!dark:)hover:bg-zinc-100/g, replace: 'hover:bg-zinc-100 dark:hover:bg-zinc-800' },
    { regex: / :bg-zinc-900/g, replace: ' dark:bg-zinc-900' },
    { regex: / :ring-offset-black/g, replace: ' dark:ring-offset-black' },
    { regex: / :text-zinc-100/g, replace: ' dark:text-zinc-100' }
];

function processDirectory(dir) {
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (['node_modules', '.next', '.git'].includes(file)) continue;
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let modified = false;

            for (const { regex, replace } of replacements) {
                if (regex.test(content)) {
                    content = content.replace(regex, (match) => {
                        // Avoid double matching like bg-white dark:bg-white dark:bg-zinc-950
                        return replace;
                    });
                    modified = true;
                }
            }

            // Cleanup duplicates if any occurred from rerunning
            content = content.replace(/(dark:bg-zinc-950)+/g, 'dark:bg-zinc-950');
            content = content.replace(/(dark:bg-zinc-950 )+/g, 'dark:bg-zinc-950 ');
            content = content.replace(/bg-white dark:bg-zinc-950 dark:bg-zinc-950/g, 'bg-white dark:bg-zinc-950');

            if (modified) {
                fs.writeFileSync(fullPath, content, 'utf8');
                console.log(`Updated ${fullPath}`);
            }
        }
    }
}

processDirectory(directory);
console.log('Done mapping dark mode classes.');

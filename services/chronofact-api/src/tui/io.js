export async function ask(prompt, label) {
  return (await prompt.question(label)).trim();
}

export async function askDefault(prompt, label, defaultValue) {
  const suffix = defaultValue ? ` [${defaultValue}]` : "";
  const answer = await ask(prompt, `${label}${suffix}: `);
  return answer || defaultValue;
}

export async function requireAnswer(prompt, label) {
  const answer = await ask(prompt, label);
  if (!answer) {
    throw new Error(`${label.replace(/[:\s]+$/, "")} is required.`);
  }
  return answer;
}

export function createPromptSession(rl, outputStream) {
  const lines = rl[Symbol.asyncIterator]();
  return {
    async question(label) {
      write(outputStream, label);
      const line = await lines.next();
      if (line.done) {
        throw new Error("Input closed before the TUI action completed.");
      }
      return line.value;
    },
  };
}

export function write(stream, message) {
  stream.write(message);
}

export function getArgValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

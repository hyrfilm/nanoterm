export class CommandHistory {
  private entries: string[] = [];
  private cursor = -1;
  private tempLine = '';
  private maxSize: number;

  constructor(maxSize = 500) {
    this.maxSize = maxSize;
  }

  push(command: string): void {
    if (!command.trim()) return;
    if (this.entries.length > 0 && this.entries[this.entries.length - 1] === command) return;
    this.entries.push(command);
    if (this.entries.length > this.maxSize) this.entries.shift();
    this.resetCursor();
  }

  resetCursor(): void {
    this.cursor = this.entries.length;
    this.tempLine = '';
  }

  navigateUp(currentLine: string): string | null {
    if (this.cursor <= 0) return null;
    if (this.cursor === this.entries.length) {
      this.tempLine = currentLine;
    }
    this.cursor--;
    return this.entries[this.cursor];
  }

  navigateDown(): string | null {
    if (this.cursor >= this.entries.length) return null;
    this.cursor++;
    if (this.cursor === this.entries.length) return this.tempLine;
    return this.entries[this.cursor];
  }

  getEntries(): string[] {
    return [...this.entries];
  }
}

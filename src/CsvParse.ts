export type CsvData = ((string | number)[] | null)[];

export default class CsvParser {
  public static parseLine(text: string): string[] | null {
    const re_valid =
      /^\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*(?:,\s*(?:'[^'\\]*(?:\\[\S\s][^'\\]*)*'|"[^"\\]*(?:\\[\S\s][^"\\]*)*"|[^,'"\s\\]*(?:\s+[^,'"\s\\]+)*)\s*)*$/;
    const re_value =
      /(?!\s*$)\s*(?:'([^'\\]*(?:\\[\S\s][^'\\]*)*)'|"([^"\\]*(?:\\[\S\s][^"\\]*)*)"|([^,'"\s\\]*(?:\s+[^,'"\s\\]+)*))\s*(?:,|$)/g;
    // Return NULL if input string is not well formed CSV string.
    if (!re_valid.test(text)) return null;
    const res = []; // Initialize array to receive values.
    text.replace(
      re_value, // "Walk" the string using replace with callback.
      function (m0, m1, m2, m3) {
        // Remove backslash from \' in single quoted values.
        if (m1 !== undefined) res.push(m1.replace(/\\'/g, "'"));
        // Remove backslash from \" in double quoted values.
        else if (m2 !== undefined) res.push(m2.replace(/\\"/g, '"'));
        else if (m3 !== undefined) res.push(m3);
        return ''; // Return empty string.
      },
    );
    // Handle special case of empty last value.
    if (/,\s*$/.test(text)) res.push('');
    return res;
  }

  public static parse(text: string): CsvData {
    const lines = text.split('\n');
    const data: CsvData = [];
    for (const line of lines) {
      const parsedLine = CsvParser.parseLine(line);
      if (parsedLine === null || parsedLine.length === 0) {
        data.push(null);
      } else {
        data.push(parsedLine.map(CsvParser.parseValue));
      }
    }
    return data;
  }

  private static parseValue(value: string): string | number {
    value = value.trim();

    if (isNaN(Number(value))) {
      return value;
    }
    return Number(value);
  }
}

import WordSegmentBuilder from "./WordSegmentBuilder";
import { b2u, g2u, isDBCSLead } from "../../js/string_util";
import { symbolTable } from "../../js/symbol_table";

function isBadDBCS(u) {
  return symbolTable["x" + u.charCodeAt(0).toString(16)] == 3;
}

function shouldForceWidth(u) {
  const code = symbolTable["x" + u.charCodeAt(0).toString(16)];
  return code == 1 || code == 2;
}

// Convert DBCS bytes to Unicode based on charset
// Uses global charset from window if available, defaults to gbk
function dbcsToUnicode(bytes, charset) {
  if (charset === "gbk") return g2u(bytes);
  return b2u(bytes); // default big5
}

export class ColorSegmentBuilder {
  constructor(forceWidth, charset) {
    this.segs = [];
    this.wordBuilder = WordSegmentBuilder.NullObject;
    this.forceWidth = forceWidth;
    // Use provided charset, or global window._pttchromeCharset set by the app, or default to gbk
    this.charset =
      charset ||
      (typeof window !== "undefined" && window._pttchromeCharset) ||
      "gbk";
    this.lead = null;
  }

  beginSegment(color) {
    this.segs.push(this.wordBuilder.build());
    this.wordBuilder = new WordSegmentBuilder(this.segs.length, color);
  }

  appendNormalChar(text, color) {
    if (!this.wordBuilder.isLastSegmentSameColor(color))
      this.beginSegment(color);
    this.wordBuilder.appendNormalText(text);
  }

  readChar(ch) {
    if (!this.lead) {
      if (isDBCSLead(ch.ch)) {
        this.lead = ch;
        return;
      }

      this.appendNormalChar(ch.ch, ch.getColor());
      return;
    }
    const { lead } = this;
    const leadColor = lead.getColor();
    this.lead = null;
    const text = dbcsToUnicode(lead.ch + ch.ch, this.charset);
    if (text.length !== 1) {
      // Conversion error.
      this.appendNormalChar("?", leadColor);
      this.appendNormalChar(ch.ch == "\x20" ? " " : "?", ch.getColor());
      return;
    }
    if (isBadDBCS(text)) {
      this.appendNormalChar("?", leadColor);
      this.appendNormalChar("?", ch.getColor());
      return;
    }
    if (!leadColor.equals(ch.getColor())) {
      this.beginSegment(leadColor);
      this.wordBuilder.appendTwoColorWord(
        text,
        leadColor,
        ch.getColor(),
        this.forceWidth
      );
      return;
    }
    const forceWidth = shouldForceWidth(text) ? this.forceWidth : 0;
    if (!forceWidth) {
      this.appendNormalChar(text, leadColor);
      return;
    }
    if (!this.wordBuilder.isLastSegmentSameColor(leadColor))
      this.beginSegment(leadColor);
    this.wordBuilder.appendForceWidthWord(text, forceWidth);
  }

  build() {
    this.beginSegment();
    return this.segs;
  }
}

ColorSegmentBuilder.accumulator = (builder, ch) => {
  builder.readChar(ch);
  return builder;
};

export default ColorSegmentBuilder;

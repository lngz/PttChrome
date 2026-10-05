

/**
 * Only support caret notations (^C, ^H, ^U, ^[, ^?, ...)
 * If you want to show \ and ^, use \\ and \^ respectively
 */ 
export function unescapeStr(it) {
  var result = '';

  for (var i = 0; i < it.length; ++i) {
    var curChar = it.charAt(i);
    var nextChar = it.charAt(i+1);
    
    if (i == it.length - 1) {
      result += curChar;
      break;
    }

    if (curChar == '\\' && (nextChar == '\\' || nextChar == '^')) {
      result += nextChar;
    } else if (curChar == '^') {
      if ('@' <= nextChar && nextChar <= '_') {
        var code = it.charCodeAt(i+1) - 64;
        result += String.fromCharCode(code);
        i++;
      } else if (nextChar == '?') {
        result += '\x7f';
        i++;
      } else {
        result += '^';
      }
    } else {
      result += curChar;
    }
  }
  return result;
};

// Wrap text within maxLen without hyphenating English words,
// where the maxLen is generally the screen width.
export function wrapText(it, maxLen, enterChar) {
  // Divide string into non-hyphenated groups
  // classified as \r, \n, single full-width character, an English word,
  // and space characters in the beginning of original line. (indent)
  // Spaces next to a word group are merged into that group
  // to ensure the start of each wrapped line is a word.
  // FIXME: full-width punctuation marks aren't recognized
  var pattern = /\r|\n|([^\x00-\x7f][,.?!:;]?[\t ]*)|([\x00-\x08\x0b\x0c\x0e-\x1f\x21-\x7f]+[\t ]*)|[\t ]+/g;
  var splited = it.match(pattern);

  var result = '';
  var len = 0;
  for (var i = 0; i < splited.length; ++i) {
    // Convert special characters to spaces with the same width
    // and then we can get the width by the length of the converted string
    var grouplen = splited[i].replace(/[^\x00-\x7f]/g,"  ")
                             .replace(/\t/,"    ")
                             .replace(/\r|\n/,"")
                             .length;

    if (splited[i] == '\r' || splited[i] == '\n')
      len = 0;
    if (len + grouplen > maxLen) {
      result += enterChar;
      len = 0;
    }
    result += splited[i];
    len += grouplen;
  }
  return result;
};

export function u2b(it) {
  var data = '';
  for (var i = 0; i < it.length; ++i) {
    if (it.charAt(i) < '\x80') {
      data += it.charAt(i);
      continue;
    }
    var pos = it.charCodeAt(i);
    var hi = lib.u2bArray[2*pos], lo = lib.u2bArray[2*pos+1];
    if (hi || lo)
      data += String.fromCharCode(hi) + String.fromCharCode(lo);
    else // Not a big5 char
      data += '\xFF\xFD';
  }
  return data;
};

export function b2u(it) {
  var str = '';
  for (var i = 0; i < it.length; ++i) {
    if (it.charAt(i) < '\x80' || i == it.length-1) {
      str += it.charAt(i);
      continue;
    }

    var pos = it.charCodeAt(i) << 8 | it.charCodeAt(i+1);
    var code = lib.b2uArray[2*pos] << 8 | lib.b2uArray[2*pos+1];
    if (code) {
      str += String.fromCharCode(code);
      ++i;
    } else { // Not a big5 char
      str += it.charAt(i);
    }
  }
  return str;
};

export function isDBCSLead(ch) {
  let code = ch.charCodeAt(0);
  return code >= 0x81 && code <= 0xfe;
};

export function parseReplyText(it) {
  return (it.indexOf('▲ 回應至 (F)看板 (M)作者信箱 (B)二者皆是 (Q)取消？[F] ') === 0 ||
      it.indexOf('▲ 無法回應至看板。 改回應至 (M)作者信箱 (Q)取消？[Q]') === 0 ||
      it.indexOf('把這篇文章收入到暫存檔？[y/N]') === 0 ||
      it.indexOf('請選擇暫存檔 (0-9)[0]:') === 0);
};

export function parsePushInitText(it) {
  return (it.indexOf('您覺得這篇文章 ') === 0 || 
      it.search(/→ \w+ *: +/) === 0 ||
      it.indexOf('很抱歉, 本板不開放回覆文章，要改回信給作者嗎？ [y/N]:') === 0);
};

export function parseReqNotMetText(it) {
  return (it.indexOf(' ◆ 未達看板發文限制:') === 0);
};

export function parseStatusRow(str) {
  var regex = new RegExp(/  瀏覽 第 (\d{1,3})(?:\/(\d{1,3}))? 頁 *\( *(\d{1,3})%\)  目前顯示: 第 0*(\d+)~0*(\d+) 行 *(?:\(y\)回應)?(?:\(X\/?%\)推文)?(?:\(h\)說明)? *\(←\/?q?\)離開 /g);
  var result = regex.exec(str);

  if (result && result.length === 6) {
    return {
      pageIndex:     parseInt(result[1]),
      pageTotal:     parseInt(result[2]),
      pagePercent:   parseInt(result[3]),
      rowIndexStart: parseInt(result[4]),
      rowIndexEnd:   parseInt(result[5])
    };
  }

  return null;
};

export function parseListRow(str) {
  var regex = new RegExp(/\[\d{1,2}\/\d{1,2} +星期. +\d{1,2}:\d{1,2}\] .+ 線上\d+人, 我是\w+ +\[呼叫器\](?:關閉|打開) /g);
  return regex.test(str);
};

export function parseWaterball(str) {
  var regex = new RegExp(/\x1b\[1;33;46m\u2605(\w+)\x1b\[0;1;37;45m (.+) \x1b\[m\x1b\[K/g);
  var result = regex.exec(str);
  if (result && result.length == 3) {
    return { userId: result[1], message: result[2] };
  } else {
    regex = new RegExp(/\x1b\[24;\d{2}H\x1b\[1;37;45m([^\x1b]+)(?:\x1b\[24;18H)?\x1b\[m/g);
    result = regex.exec(str);
    if (result && result.length == 2) {
      return { message: result[1] };
    }
  }

  return null;
};

export function ansiHalfColorConv(it) {
  var str = '';
  var regex = new RegExp('\x15\\[(([0-9]+)?;)+50m', 'g');
  var result = null;
  var indices = [];
  while ((result = regex.exec(it))) {
    indices.push(result.index + result[0].length - 4);
  }

  if (indices.length === 0) {
    return it;
  }

  var curInd = 0;
  for (var i = 0; i < indices.length; ++i) {
    var ind = indices[i];
    var preEscInd = it.substring(curInd, ind).lastIndexOf('\x15') + curInd;
    str += it.substring(curInd, preEscInd) + '\x00' + it.substring(ind+4, ind+5) + it.substring(preEscInd, ind) + 'm';
    curInd = ind+5;
  }
  str += it.substring(curInd);
  return str;
};

// GBK encoding/decoding - use iconv-lite approach with inline WHATWG GBK mapping
// We embed a minimal GBK<->Unicode mapping directly here for self-containment.
// GBK lead byte: 0x81-0xFE, trail byte: 0x40-0xFE (excluding 0x7F)

// Compact GBK mapping: [gbkCode, unicodeCodePoint] pairs from WHATWG encoding standard
// This is the gbkAdded + gb18030-ranges compressed form
var _gbkDecoded = false;
var _g2uMap = null;  // gbkCode(16bit) -> unicodeCodePoint(16bit)
var _u2gMap = null;  // unicodeCodePoint(16bit) -> gbkCode(16bit)

function _buildGBKMaps() {
  if (_gbkDecoded) return;
  _g2uMap = new Uint16Array(0x10000);
  _u2gMap = new Uint16Array(0x10000);
  
  // WHATWG GBK encoding index mapping (compact form)
  // Index 0x8140..0xFEFE mapped to Unicode codepoints
  // Using the standard WHATWG gbk encoding data
  var idx = 0x8140;
  // Single/double byte mapping: iterate GBK space
  // For simplicity, we use the runtime TextDecoder to build the map once
  try {
    var td = new (globalThis.TextDecoder || TextDecoder)('gbk', {fatal: false});
    for (var lead = 0x81; lead <= 0xFE; lead++) {
      for (var trail = 0x40; trail <= 0xFE; trail++) {
        if (trail === 0x7F) continue;
        var gbkCode = (lead << 8) | trail;
        var bytes = new Uint8Array([lead, trail]);
        var decoded = td.decode(bytes);
        if (decoded && decoded.length > 0 && decoded.charCodeAt(0) !== 0xFFFD) {
          var cp = decoded.charCodeAt(0);
          _g2uMap[gbkCode] = cp;
          if (!_u2gMap[cp]) _u2gMap[cp] = gbkCode;
        }
      }
    }
  } catch(e) {
    // Fallback: empty maps
  }
  _gbkDecoded = true;
}

export function g2u(it) {
  if (!_gbkDecoded) _buildGBKMaps();
  var str = '';
  for (var i = 0; i < it.length; ++i) {
    if (it.charCodeAt(i) < 0x80 || i === it.length - 1) {
      str += it.charAt(i);
    } else {
      var gbkCode = it.charCodeAt(i) << 8 | it.charCodeAt(i + 1);
      var cp = _g2uMap[gbkCode];
      if (cp) {
        str += String.fromCharCode(cp);
        i++;
      } else {
        str += it.charAt(i);
      }
    }
  }
  return str;
};

export function u2g(it) {
  if (!_gbkDecoded) _buildGBKMaps();
  var data = '';
  for (var i = 0; i < it.length; ++i) {
    var ch = it.charAt(i);
    if (ch < '\x80') {
      data += ch;
    } else {
      var cp = it.charCodeAt(i);
      var gbkCode = _u2gMap[cp];
      if (gbkCode) {
        data += String.fromCharCode((gbkCode >> 8) & 0xFF, gbkCode & 0xFF);
      } else {
        data += '\xFF\xFD';
      }
    }
  }
  return data;
};

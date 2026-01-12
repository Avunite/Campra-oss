const MAX_CSS_LENGTH = 65536; // 64 KB limit

const ALLOWED_PROPERTIES = new Set([
  // Include all previously allowed properties
  'color', 'font-family', 'font-size', 'font-weight', 'line-height', 'text-align',
  'text-decoration', 'text-transform', 'letter-spacing', 'display', 'width', 'height',
  'max-width', 'max-height', 'min-width', 'min-height', 'margin', 'padding', 'border',
  'background-color', 'opacity', 'box-shadow', 'transform', 'transition', 'background',
  'animation', 'animation-delay', 'animation-direction', 'animation-duration',
  'animation-fill-mode', 'animation-iteration-count', 'animation-name',
  'animation-play-state', 'animation-timing-function', 'cursor', 'pointer-events',
  'user-select', 'visibility', 'word-break', 'word-wrap', 'overflow', 'text-overflow',
  'clip-path', 'filter',
  // Additional properties
  'position', 'top', 'right', 'bottom', 'left', 'z-index', 'float', 'clear',
  'object-fit', 'object-position', 'content', 'overflow-x', 'overflow-y',
  'text-shadow', 'vertical-align', 'white-space', 'border-radius', 'justify-content',
  'align-items', 'flex-wrap', 'flex-direction', 'flex'
]);

const ALLOWED_AT_RULES = new Set(['@media', '@keyframes', '@font-face', '@import']);

const ALLOWED_PSEUDO_CLASSES = new Set([
  ':hover', ':active', ':focus', ':visited', ':first-child', ':last-child',
  ':nth-child', ':nth-of-type', ':not', ':before', ':after'
]);

function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function sanitizeUrl(url) {
  if (isValidUrl(url)) {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === 'media.campra.app' || 
        parsedUrl.hostname === 'fonts.googleapis.com') {
      return url;
    }
  }
  return '';
}

function sanitizeProperty(property, value) {
  if (!ALLOWED_PROPERTIES.has(property)) {
    return '';
  }
  
  if (property === 'background-image' || property === 'background') {
    const urlMatch = value.match(/url\(['"]?(.*?)['"]?\)/);
    if (urlMatch) {
      const sanitizedUrl = sanitizeUrl(urlMatch[1]);
      if (sanitizedUrl) {
        return `${property}: url('${sanitizedUrl}');`;
      }
      return '';
    }
  }
  
  return `${property}: ${value};`;
}

function sanitizeCss(css) {
  if (typeof css !== 'string') {
    return '';
  }
  
  css = css.trim();
  if (css === '') {
    return '';
  }
  
  if (css.length > MAX_CSS_LENGTH) {
    css = css.slice(0, MAX_CSS_LENGTH);
  }
  
  // Remove comments
  css = css.replace(/\/\*[\s\S]*?\*\//g, '');
  
  let sanitizedCss = '';
  let nestedLevel = 0;
  let inAtRule = false;
  let currentAtRule = '';
  let buffer = '';
  
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    
    if (char === '{') {
      nestedLevel++;
      const ruleName = buffer.trim().split(/\s+/)[0];
      
      if (ALLOWED_AT_RULES.has(ruleName)) {
        inAtRule = true;
        currentAtRule = ruleName;
        sanitizedCss += buffer + char;
      } else if (inAtRule || nestedLevel === 1) {
        sanitizedCss += buffer + char;
      }
      
      buffer = '';
    } else if (char === '}') {
      nestedLevel--;
      
      if (inAtRule) {
        if (nestedLevel === 0) {
          inAtRule = false;
          currentAtRule = '';
        }
        sanitizedCss += buffer + char;
      } else if (nestedLevel === 0) {
        const properties = buffer.split(';').filter(prop => prop.trim() !== '');
        const sanitizedProperties = properties.map(prop => {
          const [property, ...valueParts] = prop.split(':');
          const value = valueParts.join(':').trim();
          return sanitizeProperty(property.trim(), value);
        }).filter(prop => prop !== '');
        
        sanitizedCss += sanitizedProperties.join(' ') + char;
      } else {
        sanitizedCss += buffer + char;
      }
      
      buffer = '';
    } else {
      buffer += char;
    }
  }
  
  return sanitizedCss;
}

export { sanitizeCss };
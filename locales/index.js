/**
 * Languages Loader
 */

const fs = require('fs');
let languages = []
let languages_custom = []

const merge = (...args) => args.reduce((a, c) => ({
	...a,
	...c,
	...Object.entries(a)
		.filter(([k]) => c && typeof c[k] === 'object')
		.reduce((a, [k, v]) => (a[k] = merge(v, c[k]), a), {})
}), {});


fs.readdirSync(__dirname).forEach((file) => {
	if (file.includes('.json')){
		file = file.slice(0, file.indexOf('.'))
		languages.push(file);
	}
})

// Check if custom locales directory exists before trying to read it
const customLocalesPath = __dirname + '/../custom/locales';
if (fs.existsSync(customLocalesPath)) {
	fs.readdirSync(customLocalesPath).forEach((file) => {
		if (file.includes('.json')){
			file = file.slice(0, file.indexOf('.'))
			languages_custom.push(file);
		}
	})
}

const primaries = {
	'en': 'US',
	'ja': 'JP',
	'zh': 'CN',
};

const locales = languages.reduce((a, c) => {
	try {
		a[c] = JSON.parse(fs.readFileSync(`${__dirname}/${c}.json`, 'utf-8')) || {};
	} catch (e) {
		console.error(`Error loading locale ${c}.json:`, e);
		a[c] = {};
	}
	return a;
}, {});

const locales_custom = {};
if (fs.existsSync(customLocalesPath)) {
	languages_custom.forEach(c => {
		try {
			locales_custom[c] = JSON.parse(fs.readFileSync(`${customLocalesPath}/${c}.json`, 'utf-8')) || {};
		} catch (e) {
			console.error(`Error loading custom locale ${c}.json:`, e);
		}
	});
}
Object.assign(locales, locales_custom)

module.exports = Object.entries(locales)
	.reduce((a, [k ,v]) => (a[k] = (() => {
		const [lang] = k.split('-');
		switch (k) {
			case 'ja-JP': return v;
			case 'ja-KS':
			case 'en-US': return merge(locales['ja-JP'], v);
			default: return merge(
				locales['ja-JP'],
				locales['en-US'],
				locales[`${lang}-${primaries[lang]}`] || {},
				v
			);
		}
	})(), a), {});

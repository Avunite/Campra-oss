const { DataSource } = require('typeorm');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// Load config from YAML
const configPath = path.join(__dirname, '../../.config/default.yml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

// Create DataSource instance
const AppDataSource = new DataSource({
    type: 'postgres',
    host: config.db.host,
    port: config.db.port,
    username: config.db.user,
    password: config.db.pass,
    database: config.db.db,
    extra: config.db.extra,
    entities: [path.join(__dirname, 'built/db/postgre.js')],
    migrations: [path.join(__dirname, 'migration/*.js')],
    synchronize: false,
    logging: true
});

// Initialize the data source
AppDataSource.initialize()
    .then(() => {
        console.log("Data Source has been initialized");
    })
    .catch((error) => {
        console.error("Error initializing Data Source", error);
    });

// Export the DataSource instance wrapped in an object
module.exports = { dataSource: AppDataSource }; 
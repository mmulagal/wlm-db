import fs from 'fs'

const wadConfig = fs
    .readFileSync('./wad-config.json', 'utf8')
    .replaceAll('%VITE_WORKLOAD_IFRAME_URL%', process.env.VITE_WORKLOAD_IFRAME_URL)

if (!fs.existsSync('build')) {
    fs.mkdirSync('build')
}

fs.writeFileSync('build/wad-config.json', wadConfig)

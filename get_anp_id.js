import * as fs from 'fs' 

let args = process.argv
args.splice(0,2)

let pokemonToGet = args.join(' ');

const anp = JSON.parse(fs.readFileSync('adjusted_national_pokedex.json','utf-8'));

let id = anp.indexOf(pokemonToGet.toLowerCase())+1;

console.log(`${pokemonToGet} is ANP ID# ${id}`);
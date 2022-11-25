import Pokedex from 'pokedex-promise-v2';
import * as fs from 'fs';
import { kMaxLength } from 'buffer';

//Thanks, https://pokeapi.co Y'all are great <3
const P = new Pokedex();

//Very simple and neieve walk function.
//Thank god there aren't any pokemon with like 300 evolutions.
//Then I'd 100% run into a known problem xD
function walkEvoLine(obj,results,depth) {
    //Variable setup
    results = results || [];
    depth = depth || 0;
    depth++;

    //Return our results if there's nothing left to look through
    if (obj.chain == null && obj.evolves_to == null) {
        return results;
    }

    //For some reason pokeapi is storing the first pokemon
    //in an evolution chain "outside" the chain. Hard to explain.
    //Also kinda annoying.
    if (obj.chain && obj.chain.species && !(results.includes(obj.chain.species.name))) results.push(obj.chain.species.name)

    //Same reason as the annoyance above - they're storing things weird.
    //Some things are in .chain, some things don't have a .chain [...]
    //So I just have the same code compy/pasted with one minor change to make it work.
    //Totally bodged, totally don't care.
    if (obj.chain) {
        obj.chain.evolves_to.forEach((val)=>{
            //Sometimes we get dupes. Try to avoid that where possible.
            if (!results.includes(val.species.name)) {
                results.push(val.species.name);
            }

            //Don't do recursion like this.
            //The only reason this works is because I'm using a VERY small data set.
            results.concat(walkEvoLine(val,results,depth));
        });
    } else if (obj.evolves_to) {
        obj.evolves_to.forEach((val)=>{
            //Sometimes we get dupes. Try to avoid that where possible.
            if (!results.includes(val.species.name)) {
                results.push(val.species.name);
            }

            //Don't do recursion like this.
            //The only reason this works is because I'm using a VERY small data set.
            results.concat(walkEvoLine(val,results,depth)); 
        });
    }
    //Return what we have.
    return results
}

//Request and store the evolution lines.
function buildEvoLines(lineCount,prevLine,lines) {
    //Variable setup.
    lineCount = lineCount;
    prevLine = prevLine || 0;
    lines = lines || [];
    
    //We're returning a promise, because pokedex-promise-v2's developer hates async.
    return new Promise((res,rej) => {
        //A variable for me to play with timing. You don't really have to touch it. Promise.
        let toWait = /*1000*5+*/10
        //If we haven't found out how many evolution lines there are, we need to do that.
        if (lineCount == null) {
            //Custom function to just pull the amount of evolution lines there are.
            getEvoLineCount().then((response)=>{
                //Some logging, so people know how long they should expect to wait for
                console.log(`Needing to wait around ${toWait}ms between requests to avoid getting auto-banned, generating the Adjusted National Pokedex will take about ${toWait*response}ms or ${(toWait*response)/1000/60} minutes.`)
                //Start pulling evolution line data
                res(buildEvoLines(response))
            }).catch((err)=>{
                //If we came across an error, which we shouldn't, error out.
                rej(err);
            })
        } else {
            //Add 1 to prevLine. Technically, this isn't the previous line, but rather the current.
            //This is what I get for naming variables before I start using them.
            prevLine++;
            //If we;ve run out of lines, finish up.
            if (prevLine > lineCount) return res(lines);
            //Wait for a few ms before pulling more data. More of a formality than actually required.
            //I doubt either my PC or my network could saturate the API's bandwith. 
            setTimeout(()=>{
                //Get the evolution chain.
                P.getEvolutionChainById(prevLine)
                .then((response)=>{
                    //Logging so the user knows we're actually doing things
                    console.log(`[${prevLine}/${lineCount}] building ${response.chain.species.name} evolution line...`);
                    //Look through the evolution chain data, and pick out what we want
                    lines.push(walkEvoLine(response));
                    //And... next loop.
                    res(buildEvoLines(lineCount,prevLine,lines));
                }).catch((err)=>{
                    //If we error, we do actually care what it is here.
                    //9 tiems out of 10, it's just that we've already dealt with the next pokemon
                    //in the line, so they didn't add a dupe.
                    //Why in the world they didn't remove empty spaces I have no idea, but whatever.
                    console.log(`[${prevLine}/${lineCount}] Error getting evolution line: ${err.response.data}`)
                    console.log(`[${prevLine}/${lineCount}] Skipping.`);
                    res(buildEvoLines(lineCount,prevLine,lines));
                });
            },toWait);
        }
    })
}

//Get the number of evolution chains.
//Technically, I could also use this to get
//all the data more or less all at once, but to be honest,
//load times become an issue at that point, and I cba.
function getEvoLineCount() {
    return new Promise((res,rej)=>{
        //Get the list of chains. Technically we're only pulling Bulbasaur,
        //and we don't even use it besides getting the number of chains there are. 
        P.getEvolutionChainsList({limit:1,offset:0})
        .then((response)=>{
            //Return the number of chains
            res(response.count);
        })
        .catch((err)=>{
            //Error out. We need this data to function.
            throw err;
        })
    })
}

//Actually running the program.

//Did we already pull data? If so, don't do it again, it takes forever. (two minutes is a long time, ok??)
if (fs.existsSync('evolution_chains.json')) {
    //Read our previously-sourced data
    let lines = JSON.parse(fs.readFileSync('evolution_chains.json','utf-8'));
    
    //Set up an array to hold it all 
    let pokedex = []

    //Concatenate all the lines into a single array
    for (let chain of lines) {
        pokedex = pokedex.concat(chain)
    }

    //Save it!
    fs.writeFileSync('adjusted_national_pokedex.json',JSON.stringify(pokedex,'',4));

} else { //Otherwise, we have to get all the data... Yay...

    //Get the data... so slowwww...
    buildEvoLines().then((lines)=>{
        //Then write the data to a json file.
        //We do this so you don't have to pull data every single time you want to compile
        //the JSON. It does mean you have to delete this file later, if there's a new game.
        fs.writeFileSync('evolution_chains.json',JSON.stringify(lines,'',4))
        
        //Everything after this point is identical to the above.
        let pokedex = []
        for (let chain of lines) {
            pokedex = pokedex.concat(chain)
        }
    
        fs.writeFileSync('adjusted_national_pokedex.json',JSON.stringify(pokedex,'',4));
    })
}
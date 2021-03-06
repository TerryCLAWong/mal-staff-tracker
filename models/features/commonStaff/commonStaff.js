const Errors = require('../../errors/errors')
const CommonStaff = {}


/*
Validates request body parameters for CommonStaff
*/
const {body} = require('express-validator/check')
CommonStaff.validate = (method) => {
    if (method == "getCommonEmployees" || method == "getCommonStudios") { //validation for both methods are the same
        
        return [
            body("userName").custom((value, {req}) => {
                if (typeof value == "string") {
                    return true
                }
                throw new Error("Value must be a string") 
            }),
            body(["lower", "upper"]).custom((value, {req}) => {
                if (value == undefined) {
                    throw new Error("Value is required") 
                } else if (Number.isInteger(value)) {
                    if (value >= 0 && value <= 10) {
                        return true
                    }
                    throw new Error("Value must be in [1,10]")  
                }
                throw new Error("Value must be an integer") 
            }),
            body("commonCount").custom((value, { req }) => {
                if (value == undefined) {
                    throw new Error("Value is required")  
                } else if (Number.isInteger(value)) {
                    if (value > 0) {
                        return true
                    }
                    throw new Error("Value must be strictly positive")  
                }
                throw new Error("Value must be an integer") 
            })
        ]
    }
}


const {validationResult} = require('express-validator/check')
CommonStaff.getCommonEmployees = function(axios, accessToken) {
    return async (req, res) => {
        //Handle Errors post validation
        ok = Errors.checkValidationErrors(req, res, validationResult)
        if (ok == false) {
            console.log("aaaaaa")
            return
        }

        //Get Animelist
        result = await getAnimeList(req, axios, accessToken)
        
        //On Successful 
        if (result.error == null) {
            console.log("all good")
            res.status(200)
            res.send({
                "employeeList" : "TODO - object containing lots of stuff about employees"
            })
        }
    }
}

CommonStaff.getCommonStudios = function(axios, accessToken) {
    return async (req, res) => {
        console.log("Getting common anime studios")
        console.log(req.body)
        //Handle Errors post validation
        ok = Errors.checkValidationErrors(req, res, validationResult)
        if (ok == false) {return}
        //Get Animelist
        result = await getAnimeList(req, axios, accessToken)
        if (result.error != null) {
            //Animelist GET for the user failed
            res.status(502)
            res.send(result.error)
            return
           // console.log("AAASASAASA" + result.error)
        }

        //Remove anime out of score range
        filteredAnimelist = removeScoreOutofRange(result.animeList, req.body.upper, req.body.lower)
        console.log("Score filtering complete")
        console.log("Animelist with score filtering: \n", filteredAnimelist, "\n")

        //Generating common studios
        studioCounts = getStudioCounts(filteredAnimelist, req.body.commonCount)
        console.log("Studio Counts:\n", studioCounts)

        //Send generated data back to client
        console.log("all good") //todo - remove
        res.status(200)
        res.send({
            "studios" : studioCounts
        })
        return
    } 
}

async function getAnimeList(req, axios, accessToken) {
    authorization = "Bearer " + accessToken
    result = await axios({   
        method: "get",
        url: "https://api.myanimelist.net/v2/users/" + req.body.userName + "/animelist?",
        params: {
            "fields" : "list_status,studios",
            "limit" : 1000, //limit max to maximize speed
        },
        headers: {
            "Authorization" : authorization
        }
    }).then(
        async function thing(response) {
            console.log("Sucessful GET animelist: " + req.body.userName)//todo remove
            //Get Animelist
            data = response.data
            result = await getAnimePages(data, axios, authorization)

            //Return
            if (result.error == null) {
                return {error: null, animeList: result.animeList}
            }
            MALAPIError = {"MAL API Error": result.error}
            return {error: MALAPIError}    
        }
    ).catch(
        (error) => {
            console.log("Failed GET animelist: " + req.body.userName) //todo remove
            MALAPIError = {"MAL_API_Error": error.response.data.error}
            return {error: MALAPIError, data: null}
        }
    )
    return result
}

async function getAnimePages(data, axios) {
    nextURL = null
    animeList = {}
    /*
    The successful response does not return all anime in the animelist
    More are given in response.paging.next
    */
    while (true) {
        //Get next set of animes
        if (nextURL != null) { //ignore first page
            //Get next URL's response
            result = await axios.get(nextURL, {headers: {"Authorization": authorization}}
            ).then((response) => {
                console.log("finished reading anime page")
                return {
                    error: null,
                    data : response.data
                }
            }).catch((error) => {
                console.log("Failed to get a page from the animelist")
                return {
                    error : error.response.data.error,
                    data : null
                }
            })

            //Set next set of data if applicable
            if (result.error == null) {
                data = result.data
            } else {
                return {
                    error: result.error,
                    status: 502,
                    message: "Failed to get a page from the animelist" //todo - maybe not needed
                }
            }
        }

        //Append entries to animeList
        for (let animeEntry of data.data) {
            //Get needed values
            animeId = animeEntry.node.id
            anime = {}
            anime.score = animeEntry.list_status.score
            anime.title = animeEntry.node.title 
            anime.studios = animeEntry.node.studios
            //Append to animeList
            animeList[animeId] = anime
        }

        //Set next URL or exit
        if (data.paging.next == null) {
            return {animeList: animeList}
        } else {
            nextURL = data.paging.next
        }
    }
}

/*
Filters the animeList be removing objects that have a score outside of the [lower,upper] range
*/
function removeScoreOutofRange(animeList, upper, lower) {
    for (const animeId in animeList) {
        animeScore = animeList[animeId].score
        if (animeScore < lower || animeScore > upper) {
            delete animeList[animeId]
        }
    }
    return animeList
}

function getStudioCounts(animeList, commonAnimeCount) {
    studioCounts = {}
    studioList = []

    //Get matches
    for (const animeId in animeList) {
        //Iterate over studios
        for (const studio in animeList[animeId].studios) {
            studioName = animeList[animeId].studios[studio].name
            studioId = animeList[animeId].studios[studio].id
            if (studioCounts[studioName] == null) {
                studioEntry = {
                    count: 1,
                    id: studioId
                }
                studioCounts[studioName] = studioEntry
            } else {
                studioCounts[studioName].count++
            }
        }
    }

    //Remove counts less than commonAnimeCount
    for (const studio in studioCounts) {
        if (studioCounts[studio].count < commonAnimeCount) {
            delete studioCounts[studio]
        }
    }

    //Generate list of matches instead of map for data visualizer
    for (const studio in studioCounts) {
        studioEntry = {
            studio : studio,
            count: studioCounts[studio].count,
            id: studioCounts[studio].id
        }
        studioList.push(studioEntry)
    }
    
    //Sort from low to high count values
    studioList.sort(function(a,b) {
        return a.count - b.count
    })

    return studioList
}   

//Export
module.exports = CommonStaff;

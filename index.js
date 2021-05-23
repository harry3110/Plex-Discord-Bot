const DiscordJS = require('discord.js')
const PlexAPI = require('plex-api')
let fs = require('fs');
const fetch = require('node-fetch');
require('dotenv').config()

// Aqua color
colors = {
    'aqua': 0x5abdd1,       // For search and queue
    'red': 0xa11a1a,        // For errors
    'orange': 0xdbbb1a      // Currently playing
}

// Plex options
var songQueue = []
var queuePointer = 0
var status = null // "", "playing", "paused"
var pauseAfter = false

// Simple (may be all I need)
var plex = new PlexAPI({
    hostname:process.env.HOSTNAME,
    token: process.env.PLEX_TOKEN
})

// Complex
// var plex = new PlexAPI({
//     hostname: process.env.HOSTNAME,
//     port: process.env.PORT,
//     username: process.env.USERNAME,
//     password: process.env.PASSWORD,
//     token: process.env.PLEX_TOKEN,
//     options: {
//         identifier: process.env.IDENTIFIER,
//         product: process.env.IDENTIFIER,
//         version: "1.0",
//         deviceName: process.env.DEVICE_NAME,
//         platform: "Discord",
//         device: "Discord"
//     }
// });

// searchResults contains all of the songs IDs of a returned search, currentSearch is the query of the search
var searchResults = []
var currentSearch = null
var searchGuildMember = null

var textChannel = null
var voiceChannel = null

// To be able to pause and resume from anywhere
var dispatcher

const plex_url = (middle, protocol = "http") => protocol + "://" + process.env.HOSTNAME_REMOTE + ":" + process.env.PORT + "" + middle + "?X-Plex-Token=" + process.env.PLEX_TOKEN
const music_url = (middle) => "http://arcadia:32400" + middle + "?X-Plex-Token=" + process.env.PLEX_TOKEN
const hubSearch_url = (query) => "/hubs/search?query=" + query + "&includeExternalMedia=0&limit=" + process.env.CHOICE //&X-Plex-Token=${process.env.PLEX_TOKEN}"

// Functions
const numberToEmoji = function (num) {
    if (num == 0)      { return "0️⃣" }
    else if (num == 1) { return "1️⃣" }
    else if (num == 2) { return "2️⃣" }
    else if (num == 3) { return "3️⃣" }
    else if (num == 4) { return "4️⃣" }
    else if (num == 5) { return "5️⃣" }
    else if (num == 6) { return "6️⃣" }
    else if (num == 7) { return "7️⃣" }
    else if (num == 8) { return "8️⃣" }
    else if (num == 9) { return "9️⃣" }
    else             { return false }
}

const emojiToNumber = function (emoji) {
    if (emoji == "0️⃣")      { return 0 }
    else if (emoji == "1️⃣") { return 1 }
    else if (emoji == "2️⃣") { return 2 }
    else if (emoji == "3️⃣") { return 3 }
    else if (emoji == "4️⃣") { return 4 }
    else if (emoji == "5️⃣") { return 5 }
    else if (emoji == "6️⃣") { return 6 }
    else if (emoji == "7️⃣") { return 7 }
    else if (emoji == "8️⃣") { return 8 }
    else if (emoji == "9️⃣") { return 9 }
    else             { return false }
}

// Download the file asyncronously (from https://stackoverflow.com/questions/37614649/how-can-i-download-and-save-a-file-using-the-fetch-api-node-js)
const downloadFile = (async (url, path) => {
    const res = await fetch(url);
    const fileStream = fs.createWriteStream(path);

    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on("error", reject);
        fileStream.on("finish", resolve);
    });
});

// Discord options
const client = new DiscordJS.Client()
const guildID = "695744844378800229"
const developMode = true;

const getApp = (guildId) => {
    const app = client.api.applications(client.user.id)

    if (guildId) {
        app.guilds(guildId)
    }

    return app
}

client.on("ready", async () => {
    console.log(client.user.username + " is now ready")

    client.user.setActivity("music", {
        type: "LISTENING"
    })

    if (developMode) {
        var app = client.api.applications(client.user.id).guilds("695744844378800229").commands
    } else {
        var app = client.api.applications(client.user.id).commands
    }

    // const commands = await app.get();

    // commands.forEach(command => {
    //     try {
    //         app.commands(command["id"]).delete()
    //         console.log("Deleting: " + command["name"])
    //     } catch { }
    // });

    // console.log(commands)

    // Ping command
    await app.post({
        data: {
            name: "ping",
            description: "Test command for saying pong",
        }
    })

    /**
     * [x] /play        <name> [artist] [no. of results]
     * [x] /playnext    <name> [artist] [no. of results]
     * [x] /playfirst   <name> [artist] [no. of results]  (play the first result of the query)
     * [ ] /secretplay  <name> [artist] [no. of results]
     * [ ] /album       <name> [random yes/no]
     * [ ] /artist      <name> [random yes/no]
     * [x] /hello command       Joins, says "hello" (from Adele - Hello), then leaves
     * [x] /queue
     * [x] /now                 Shows what is currently playing
     * [x] /pauseafter          Pause the playlist after the current one has finished
     * [ ] /move <old> <new>    Move a song to a different postition in the queue
     * [ ] /remove              Remove a song from the queue
     * [x] /skip
     * [x] /pause
     * [x] /resume
     * [ ] /viewpast            Show the last 10 played songs, and if they were skipped (maybe tick or cross if played fully)
     * 
     * 
     * Other things:
     * - Do status of bot/currently playing
     */

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "secretplay",
            description: "Play a song (or add it to the queue) without announcing it to others",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                }
            ]
        }
    })

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "play",
            description: "Play a song (or add it to the queue)",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                }
            ]
        }
    })

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "playfirst",
            description: "Play (or add to queue) the first song of the search",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                }
            ]
        }
    })

    // Secret play (only the user sending the command can see what's added)
    await app.post({
        data: {
            name: "playnext",
            description: "Play a song after the current one has finished playing",
            options: [
                {
                    name: "title",
                    description: "The title of the song",
                    required: true,
                    type: 3,
                },
            ]
        }
    })

    // Pause after current song has finished playing
    await app.post({
        data: {
            name: "pauseafter",
            description: "Pause the playlist after the current one has finished"
        }
    })

    // Choose a search result without reacting to a message (eg. for /secretplay)
    await app.post({
        data: {
            name: "choice",
            description: "Choose a search option (alt to choosing through a reaction and needed when using /secretplay)",
            options: [
                {
                    name: "option",
                    description: "The number of the song to choose from the search",
                    required: true,
                    type: 4,
                },
            ]
        }
    })

    // Hello
    await app.post({
        data: {
            name: "hello",
            description: "Hello"
        }
    })

    // Leave the voice channel
    await app.post({
        data: {
            name: "leave",
            description: "Stop music and leave the voice channel"
        }
    })

    // Skip the current song
    await app.post({
        data: {
            name: "skip",
            description: "Skips the current song, and plays the next"
        }
    })

    // Shows the song currently playing
    await app.post({
        data: {
            name: "now",
            description: "Shows the song currently playing"
        }
    })

    // View the current song queue
    await app.post({
        data: {
            name: "queue",
            description: "View the current song queue"
        }
    })

    // Pause the current song
    await app.post({
        data: {
            name: "pause",
            description: "Pause the current song"
        }
    })

    // Resume the current song
    await app.post({
        data: {
            name: "resume",
            description: "Resume the current song"
        }
    })

    // Force cancels the current search in case it gets stuck (mainly for debugging)
    // This will cause an error /cancel is used when there is a search and then a reaction is added to the cancelled search.
    await app.post({
        data: {
            name: "cancel",
            description: "Force cancels the current search in case it gets stuck"
        }
    })

    client.ws.on('INTERACTION_CREATE', async interaction => {
        const { name, options } = interaction.data
        const command = name.toLowerCase()

        var guild = client.guilds.cache.get(interaction.guild_id)

            // Checks if the user is in a voice channel and if not, kicks them out
        try {
            voiceChannel = guild.member(interaction.member.user.id).voice.channel
        } catch {
            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        flags: 64,
                        embeds: [
                            {
                                title: "Error!",
                                description: "You're not in a voice channel, join one to play music!",
                                color: colors["red"],
                            }
                        ]
                    }
                }
            })

            return
        }
        


        if (command === "ping") {
            await reply(interaction, "Pong!")
        }
        else if (command === "hello") {
            if (status == null) {
                await client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [
                                {
                                    title: "Hello",
                                    color: colors["aqua"],
                                }
                            ]
                        }
                    }
                })
    
                var guild = client.guilds.cache.get(interaction.guild_id)
                voiceChannel = guild.member(interaction.member.user.id).voice.channel
    
                await voiceChannel.join().then(connection => {
                    dispatcher = connection.play("./hello.flac")
    
                    dispatcher.on("finish", () => {
                        voiceChannel.leave()
                    })
                })
            } else {
                await client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [
                                {
                                    title: "Hello",
                                    description: "There's already a song playing, try using this command when nothing is playing.",
                                    color: colors["red"],
                                }
                            ]
                        }
                    }
                })
            }
            
        }
        else if (command === "play" || command === "playnext" || command === "playfirst" || command === "secretplay") {
            console.log("Search initialised: " + options[0]['value'])
    

            // Get the voice channel of the user (or returns if not in a voice chanel)
            try {
                var guild = client.guilds.cache.get(interaction.guild_id)
                voiceChannel = guild.member(interaction.member.user.id).voice.channel
            } catch {
                await client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            flags: 64,
                            embeds: [
                                {
                                    title: "Song choice cancelled",
                                    description: "You are not in a voice chat, join one to be able to play music",
                                    color: colors["red"]
                                }
                            ]
                        }
                    }
                })
                
                return
            }

            if (command === "secretplay") {
                flagsValue = 64
            } else {
                flagsValue = 0
            }

            var songTitle = options[0]['value']

            /**
             * Plex search query
             */
            plex.query(hubSearch_url(songTitle)).then(async function (MediaContainerResult) { 
                var queryResults = MediaContainerResult["MediaContainer"]["Hub"]

                // Get the results from the array
                for (let i = 0; i < queryResults.length; i++) {                    
                    if (queryResults[i]["title"] == "Tracks") {
                        var results = queryResults[i]["Metadata"]
                        
                        // console.log(JSON.stringify(results))

                        break
                    }
                }

                // Title:           title
                // Artist:          originalTitle
                // Album artist:    grandparentTitle
                // Album:           parentTitle
                // Album cover:     thumb

                fields = []
                invalid = false;

                // If there is already a search, don't overwrite it
                if (searchResults.length > 0) {
                    await client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: flagsValue,
                                embeds: [
                                    {
                                        title: "Song choice cancelled",
                                        description: "There is already a search, close that before starting a new one",
                                        color: colors["red"]
                                    }
                                ]
                            }
                        }
                    })
                    
                } else {
                    // Used in case the search is cancelled
                    currentSearch = songTitle

                    // Get guild member (to join a voice channel) (from https://stackoverflow.com/questions/66561431/discord-js-voice-channel-with-slash-commands)
                    var guild = client.guilds.cache.get(interaction.guild_id)
                    searchGuildMember = guild.member(interaction.member.user.id)

                    // Catch if there are no items in the array
                    try {
                        for (var i = 0; i < (command == "playfirst" ? 1 : results.length); i++) {
                            // Get the available artist
                            if (results[i]["originalTitle"] == undefined) {
                                var artist = results[i]["grandparentTitle"]
                            } else {
                                var artist = results[i]["originalTitle"]
                            }
    
                            // searchResults.push(results[i]["Media"][0]["id"])
                            searchResults.push(results[i])
        
                            fields.push({
                                name: "[" + (i + 1) + "] " + results[i]["title"],
                                value: artist + " (" + results[i]["parentTitle"] + ")"
                            })
                        }
    
                        if (fields == []) {
                            invalid = true;
                        }
                    } catch {
                        invalid = true;
                    }
    
                    var title = "Choose a song"

                    if (invalid) {
                        title = "❌ " + title
                        description = "There are no songs available with that name"
                        footer = null
                        var chosenColor = colors["red"]
                    } else {
                        description = null
                        var chosenColor = colors["aqua"]

                        if (command === "secretplay") {
                            footer = {
                                text: "Select a song by typing /choice <search result number>"
                            }
                        } else {
                            footer = {
                                text: "Select a song by reaction with a number. To cancel the search, react with ❌"
                            }
                        }

                        // If the first option should be chosen automatically
                        if (results.length === 1 || command === "playfirst" || command === "playnext") {
                            title = "Song automatically chosen" + (command == "playnext" ? " and will play next" : "")

                            description = null
                            footer = null
                        }
                    }
    
                    await client.api.interactions(interaction.id, interaction.token).callback.post({
                        data: {
                            type: 4,
                            data: {
                                flags: flagsValue,
                                embeds: [
                                    {
                                        title: title,
                                        description: description,
                                        author: {
                                            name: 'Search for: ' + songTitle
                                        },
                                        color: chosenColor,
                                        fields: fields,
                                        // author: {
                                        //     name: "Harry3110",
                                        //     url: "https://github.com/harry3110/",
                                        //     icon_url: "https://i.imgur.com/wSTFkRM.png"
                                        // },
                                        footer: footer
                                    }
                                ]
                            }
                        }
                    })
                }
            })
        } else if (command === "choice") {
            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        flags: 64,
                        embeds: [
                            {
                                title: "This feature hasn't been implimented yet. Type /cancel to stop your search",
                                color: colors["red"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "leave") {
            console.log("Leaving voice channel")

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: "Leaving the voice chat...",
                                color: colors["red"],
                            }
                        ]
                    }
                }
            })

            // var guild = client.guilds.cache.get(interaction.guild_id)
            // voiceChannel = guild.member(interaction.member.user.id).voice.channel

            // songQueue = []
            status = null 

            voiceChannel.leave()

            client.user.setActivity("the waiting game", {
                type: "PLAYING"
            })

            // Set queue pointer to the final song
            queuePointer = songQueue.length - 1
        } else if (command === "now") {
            console.log("Displaying the currently playing song")

            if (songData["originalTitle"] == undefined) {
                var artist = songData["grandparentTitle"]
            } else {
                var artist = songData["originalTitle"]
            }

            if (songData["title"] == "") {
                var title = "<no title>"
            } else {
                var title = songData["title"]
            }

            // Send a checking message, and then a separate embed file
            downloadFile(plex_url(songData["thumb"], "https"), './images/temp.png').then(function () {
                // Create and send the embedded message
                client.api.interactions(interaction.id, interaction.token).callback.post({
                    data: {
                        type: 4,
                        data: {
                            content: "Checking the song currently playing..."
                        }
                    }
                })

                downloadFile(plex_url(songData["thumb"], "https"), './images/temp.png').then(function () {
                    var channel = client.channels.cache.get(interaction.channel_id)

                    // Create and send the embedded message
                    channel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["orange"])
                        .setTitle('Now playing...')
                        .addField(title, artist)
                        
                        .attachFiles(new DiscordJS.MessageAttachment('./images/temp.png'))
                        .setThumbnail("attachment://temp.png")
                    )
                })
            })
        } else if (command === "skip") {
            console.log("Skipping the current song      Current queue pointer: " + queuePointer)

            var guild = client.guilds.cache.get(interaction.guild_id)
            voiceChannel = guild.member(interaction.member.user.id).voice.channel

            // Always advance the queue position
            queuePointer++

            try {
                // If this throws an error then there is no song next
                var tester = songQueue[queuePointer]["title"]
                var title = "Skipping song..."

                playSong()
            } catch {
                // If there are no songs left in the queue
                var title = "No more songs in queue, leaving voice chat"

                status = null
                voiceChannel.leave()
            }

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: title,
                                color: colors["orange"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "pause") {
            dispatcher.pause()

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: "Pausing music..",
                                color: colors["orange"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "pauseafter") {
            pauseAfter = true

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: "Pausing the music after this song has finished!",
                                color: colors["aqua"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "resume") {
            dispatcher.resume()

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: "Resuming music..",
                                color: colors["orange"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "cancel") {
            console.log("Force cancelling search")

            searchResults = []
            currentSearch = null

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        embeds: [
                            {
                                title: "Force cancelling search",
                                color: colors["red"],
                            }
                        ]
                    }
                }
            })
        } else if (command === "queue") {
            console.log("Displaying queued songs")

            fields = []

            // If there are enough songs in the queue to display an embedded message
            if (queuePointer + 1 <= songQueue.length) {
                var description = ""

                for (let i = queuePointer; i < songQueue.length; i++) {
                    // Get the song artist
                    if (songQueue[i]["originalTitle"] == undefined) {
                        var artist = songQueue[i]["grandparentTitle"]
                    } else {
                        var artist = songQueue[i]["originalTitle"]
                    }
    
                    // Get the song title
                    if (songData["title"] == "") {
                        var title = "<no title>"
                    } else {
                        var title = songData["title"]
                    }
    
                    fields.push({
                        name: songQueue[i]["title"],
                        value: artist + " (" + songQueue[i]["parentTitle"] + ")"
                    })
                }
            } else {
                var description = "There are no more songs in the queue."
            }
            

            await client.api.interactions(interaction.id, interaction.token).callback.post({
                data: {
                    type: 4,
                    data: {
                        // flags: 64,
                        description: description,
                        embeds: [
                            {
                                title: "Song queue",
                                color: colors["orange"],
                                fields: fields,
                                footer: {
                                    text: "To add to the queue, type /play with the song you would like"
                                }
                            }
                        ]
                    }
                }
            })
        }
    })
})

client.on('message', message => {
    for (let embed of message.embeds) {
        // Add reaction emojis to selection (numbers and X to cancel)
        if (embed.title == "Choose a song" || embed.title.startsWith("Song automatically chosen")) {
            // If there is only one result, choose that one
            if (embed.fields.length === 1) {
                chooseResult(1, message)

                // Add the correct reaction
                message.reactions.removeAll()
                message.react("1️⃣")

                return
            } else {
                // Only add an X if there is more than 1 result
                message.react("❌")
            }

            for (let i = 1; i < embed.fields.length + 1; i++) {
                message.react(numberToEmoji(i))
            }

            const filter = (reaction, user) => {
                return ["1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣", "❌"].includes(reaction.emoji.name) && user.id !== message.author.id;
            };
        
            // Waits for a reaction
            message.awaitReactions(filter, { max: 1, time: 30000, errors: ['time'] })
            .then(collected => {
                const reaction = collected.first();

                emoji = reaction.emoji.name

                if (emojiToNumber(emoji) > embed.fields.length) {
                    /**
                     * If a reaction other than 1-[max options] was chosen
                     */
                    message.channel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["red"])
                        .setTitle("❌ Song choice cancelled")
                        .setDescription("Hey! That's not an option you can do, I think you're trying to break me!")
                    )
                    
                    // If there was an error, no reactions should be added
                    message.reactions.removeAll()

                    searchResults = []
                    currentSearch = null
                    return
                }

                // Remove all reactions and add the one that was selected
                message.reactions.removeAll()
                message.react(emoji)

                if (emoji == "❌") {
                    /**
                     * If the message was cancelled
                     */
                    message.channel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["red"])
                        .setTitle('Song choice cancelled')
                        .setDescription('The search for "' + currentSearch + '" was stopped')
                    )

                    searchResults = []
                    currentSearch = null
                    return
                }
                
                chooseResult(emojiToNumber(emoji), message)

                return
            })
            .catch(collected => {
                /**
                 * If a song searched timed out
                 */
                console.log("Search timed out")

                // Add the "failed interaction" emoji
                message.reactions.removeAll()
                message.react("❌")

                searchResults = []
                currentSearch = null

                message.channel.send(new DiscordJS.MessageEmbed()
                    .setColor(colors["red"])
                    .setTitle('Song choice cancelled')
                    .setDescription("Song search timed out")
                )
            })
        }
    }
})

// Add the corresponding search result to the song queue
async function chooseResult(index, message) {
    console.log("User chose result " + index + "!")

    // Get the correct song id
    songData = searchResults[index - 1]

    // Clear the play queue
    searchResults = []
    currentSearch = null

    // Get song information (each song in queue should have information for title, artist, album, thumbnail/album url, duration)
    addSongToQueue(songData, message, searchGuildMember)
}

// Adds a song to the queue
async function addSongToQueue(songData, message, member) {
    console.log("Adding " + songData["title"] + " to queue")

    textChannel = message.channel
    voiceChannel = member.voice.channel

    // console.log(message)
    // console.log(member)

    // Return if the user is not in a voice channel
    if (!voiceChannel) {
        message.channel.send(new DiscordJS.MessageEmbed()
            .setColor(colors["red"])
            .setTitle("❌ Song choice cancelled")
            .setDescription("To play music you need to be in a voice channel!")
        )

        return
	}

    // Gets the song artist, if null then the album artist
    if (songData["originalTitle"] == undefined) {
        var artist = songData["grandparentTitle"]
    } else {
        var artist = songData["originalTitle"]
    }

    if (songData["title"] == "") {
        var title = "<no title>"
    } else {
        var title = songData["title"]
    }

    // If there is one or more items in the queue, only show "Now playing" and not "Added to queue"
    if (queuePointer + 1 <= songQueue.length) {
        // Download the file and then wait till its downloaded to add it to the embedded message
        downloadFile(plex_url(songData["thumb"], "https"), './images/temp.png').then(function () {
            // Create and send the embedded message
            textChannel.send(new DiscordJS.MessageEmbed()
                .setColor(colors["aqua"])
                .setTitle('Added to queue!')
                .addField(title, artist)
                
                .attachFiles(new DiscordJS.MessageAttachment('./images/temp.png'))
                .setThumbnail("attachment://temp.png")
            )
        })
    }
    
    // Add the song to the queue or next if it is needed
    if (message.embeds[0].title == "Song automatically chosen and will play next") {
        songQueue.splice(queuePointer + 1, 0, songData)
    } else {
        songQueue.push(songData)
    }

    // Play song if none playing
    if (status == null) {
        status = "playing"
        playSong()
    }
}

// Play a song from the queue (gets the play song position from the queuePointer variable)
async function playSong() {
    if (typeof songQueue[queuePointer] === 'undefined') {
        textChannel.send(new DiscordJS.MessageEmbed()
            .setColor(colors["red"])
            .setTitle('No more songs left in queue!')
        )

        status = null
        return
    }

    songData = songQueue[queuePointer]

    // Gets the song artist, if null then the album artist
    if (songData["grandparentTitle"] != undefined) {
        var artist = songData["grandparentTitle"]
    } else if (songData["originalTitle"] != undefined) {
        var artist = songData["originalTitle"]
    } else {
        return
    }

    if (songData["title"] == "") {
        var title = "<no title>"
    } else {
        var title = songData["title"]
    }

    await voiceChannel.join().then(connection => {
        console.log("Playing: " + music_url(songData.Media[0].Part[0].key))
        dispatcher = connection.play(music_url(songData.Media[0].Part[0].key))

        // Show that the track has changed
        dispatcher.on("start", () => {
            console.log("[" + queuePointer + "]: " + '"' + title + '" is now playing!')

            // Download the file and then wait till its downloaded to add it to the embedded message
            downloadFile(plex_url(songData["thumb"], "https"), './images/temp.png').then(function () {
                // If pauseAfter is true, then pause the song and tell the user
                if (pauseAfter) {
                    dispatcher.pause()
    
                    textChannel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["orange"])
                        .setTitle('Music has been paused!')
                        .addField(title, artist)
                        .setFooter("To resume playback, type /resume")
                        
                        .attachFiles(new DiscordJS.MessageAttachment('./images/temp.png'))
                        .setThumbnail("attachment://temp.png")
                    )

                    pauseAfter = false
                } else {
                    // Create and send the embedded message
                    textChannel.send(new DiscordJS.MessageEmbed()
                        .setColor(colors["orange"])
                        .setTitle('Now playing!')
                        .addField(title, artist)

                        .attachFiles(new DiscordJS.MessageAttachment('./images/temp.png'))
                        .setThumbnail("attachment://temp.png")
                    )
                }
            })

            client.user.setActivity(title, {
                type: "PLAYING"
            })
        })

        // Changes the song
        dispatcher.on("finish", () => {
            console.log('"' + title + '" has finished playing!')
            
            // Always increase the queue pointer, ready for the next song
            queuePointer++
            playSong()
        })
        
        dispatcher.on('error', console.error)
    })
    .catch(err => console.log(err))
}

const reply = async (interaction, response) => {
    client.api.interactions(interaction.id, interaction.token).callback.post({
        data: {
            type: 4,
            data: {
                content: response
            }
        }
    })
}

client.login(process.env.TOKEN);
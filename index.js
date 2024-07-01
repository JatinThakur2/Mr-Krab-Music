const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  generateDependencyReport,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");
const ytSearch = require("yt-search");
const SpotifyWebApi = require("spotify-web-api-node");
const { libsodium } = require("libsodium-wrappers"); // Require libsodium-wrappers
const {
  token,
  spotifyClientId,
  spotifyClientSecret,
} = require("./config.json");

// Log the dependency report
console.log(generateDependencyReport());

// Initialize libsodium-wrappers
libsodium.ready.then(() => {
  console.log("libsodium-wrappers initialized successfully.");
});

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

const spotifyApi = new SpotifyWebApi({
  clientId: spotifyClientId,
  clientSecret: spotifyClientSecret,
});

let playlist = [];
let currentSongIndex = 0;
let player = createAudioPlayer();
let connection;
let loopSong = false;
let loopPlaylist = false;

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
  spotifyApi.clientCredentialsGrant().then(
    (data) => {
      spotifyApi.setAccessToken(data.body["access_token"]);
    },
    (err) => {
      console.error("Failed to retrieve access token", err);
    }
  );
});

const playSong = async (query, source) => {
  const video = (await ytSearch(query)).videos[0];
  if (video) {
    const stream = ytdl(video.url, { filter: "audioonly" });
    const resource = createAudioResource(stream);
    player.play(resource);
    connection.subscribe(player);
    console.log(`Playing from ${source}: ${query}`); // Log where the song is being played from
  } else {
    console.error("No video found.");
  }
};

const playYouTube = async (query) => {
  if (playlist.length === 0) {
    playlist.push(query);
    await playSong(query, "YouTube");
  } else {
    playlist.push(query);
  }
};

const playSpotify = async (query) => {
  try {
    if (query.includes("spotify:playlist")) {
      // Handle Spotify playlist link
      const playlistId = query.split(":")[2];
      const data = await spotifyApi.getPlaylistTracks(playlistId);
      const tracks = data.body.items;
      for (const track of tracks) {
        const trackQuery = `${track.track.name} ${track.track.artists[0].name}`;
        await playSong(trackQuery, "Spotify Playlist");
      }
    } else {
      // Assume it's a track search query
      const data = await spotifyApi.searchTracks(query);
      console.log("Spotify search result:", data.body); // Log Spotify API response
      if (data.body.tracks.items.length > 0) {
        const track = data.body.tracks.items[0];
        const trackQuery = `${track.name} ${track.artists[0].name}`;
        await playSong(trackQuery, "Spotify");
        console.log(`Playing from Spotify: ${query}`); // Log where the song is being played from
      } else {
        console.error("No track found.");
      }
    }
  } catch (error) {
    console.error("Error searching Spotify:", error);
  }
};

// Stop function to clear playlist and disconnect
const stopSong = () => {
  playlist = [];
  currentSongIndex = 0;
  player.stop();
  connection.destroy();
  connection = null;
  console.log("Playback stopped and playlist cleared.");
};

// Error handling for the audio player
player.on("error", (error) => {
  console.error("Error occurred in audio player:", error);
  // Attempt to play the next song in the playlist if an error occurs
  if (currentSongIndex < playlist.length - 1) {
    currentSongIndex++;
    playSong(playlist[currentSongIndex]);
  }
});

player.on(AudioPlayerStatus.Idle, () => {
  if (loopSong) {
    playSong(playlist[currentSongIndex]);
  } else if (loopPlaylist && currentSongIndex === playlist.length - 1) {
    currentSongIndex = 0;
    playSong(playlist[currentSongIndex]);
  } else if (currentSongIndex < playlist.length - 1) {
    currentSongIndex++;
    playSong(playlist[currentSongIndex]);
  }
});

client.on("messageCreate", async (message) => {
  // Ignore messages from bots, including the bot itself
  if (message.author.bot) return;

  const args = message.content.split(" ");
  const command = args.shift().toLowerCase();
  const query = args.join(" ");

  // Check if the user is in a voice channel before executing commands
  if (
    !message.member.voice.channel &&
    [
      "!play",
      "!pause",
      "!resume",
      "!next",
      "!previous",
      "!playlist",
      "!search",
      "!loop",
      "!loopplaylist",
      "!stop",
    ].includes(command)
  ) {
    message.reply("You need to join a voice channel first!");
    return;
  }

  // Join the voice channel if not already connected
  if (
    !connection &&
    [
      "!play",
      "!pause",
      "!resume",
      "!next",
      "!previous",
      "!playlist",
      "!search",
      "!loop",
      "!loopplaylist",
      "!stop",
    ].includes(command)
  ) {
    connection = joinVoiceChannel({
      channelId: message.member.voice.channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });
  }

  switch (command) {
    case "!play":
      if (query.includes("spotify")) {
        await playSpotify(query);
      } else {
        await playYouTube(query);
      }
      break;
    case "!pause":
      player.pause();
      break;
    case "!resume":
      player.unpause();
      break;
    case "!next":
      if (currentSongIndex < playlist.length - 1) {
        currentSongIndex++;
        await playSong(playlist[currentSongIndex]);
      }
      break;
    case "!previous":
      if (currentSongIndex > 0) {
        currentSongIndex--;
        await playSong(playlist[currentSongIndex]);
      }
      break;
    case "!playlist":
      message.reply(`Current playlist: ${playlist.join(", ")}`);
      break;
    case "!search":
      const searchResults = await ytSearch(query);
      if (searchResults.videos.length > 0) {
        const result = searchResults.videos
          .map((video, index) => `${index + 1}. ${video.title}`)
          .join("\n");
        message.reply(`Search results:\n${result}`);
      } else {
        message.reply("No results found.");
      }
      break;
    case "!loop":
      loopSong = !loopSong;
      message.reply(`Loop song is now ${loopSong ? "enabled" : "disabled"}.`);
      break;
    case "!loopplaylist":
      loopPlaylist = !loopPlaylist;
      message.reply(
        `Loop playlist is now ${loopPlaylist ? "enabled" : "disabled"}.`
      );
      break;
    case "!stop":
      stopSong();
      message.reply("Playback stopped and playlist cleared.");
      break;
    case "!help":
      message.reply(`
        **Music Bot Commands:**
        \`!play [query]\` - Adds a song to the playlist and plays it if it's the only song. Supports YouTube and Spotify queries.
        \`!pause\` - Pauses the current song.
        \`!resume\` - Resumes the paused song.
        \`!next\` - Skips to the next song in the playlist.
        \`!previous\` - Goes back to the previous song in the playlist.
        \`!playlist\` - Lists the current playlist.
        \`!search [query]\` - Searches YouTube for the query and displays the results.
        \`!loop\` - Toggles looping the current song.
        \`!loopplaylist\` - Toggles looping the entire playlist.
        \`!stop\` - Stops playback and clears the playlist.
        \`!help\` - Shows this help message.
      `);
      break;
    default:
      message.reply(
        "Unknown command. Type `!help` to see the list of commands."
      );
  }
});

client.login(token);

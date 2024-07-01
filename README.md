
# Mr-Krab-Music

## Description
Discord bot to play the music from youtube and spotify

## Installation
To install and run this project locally, follow these steps:

1. Clone the repository.
2. Install dependencies using `npm install`.
3. Configure your `config.json` file (see below).
4. Start the application using `node index.js`.

## Configuration
Before running the application, create a `config.json` file in the root directory with the following structure:

```json
{
  "token": "discord_token_here",
  "spotifyClientId": "your_spotify_client_id",
  "spotifyClientSecret": "your_spotify_client_secret",
  "spotifyRedirectUri": "your_spotify_redirect_uri"
}

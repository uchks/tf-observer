<img src="https://unethicalcdn.com/enmity/tf-observer.png" width="200" height="200" alt="tf-observer logo" align="left"/><br>
<p align="left">
  <strong>tf-observer by uchks</strong><br>
  A discord bot that tracks whenever an update is released to Discord's TestFlight and sends an embed.<br>
</p>


<sub>Made for <a href="https://discord.gg/rMdzhWUaGT">Enmity</a>, a Discord client mod for iOS (and soon Android) devices.<br>
You can view it in action in the "testflight-updates" channel, or <a href="https://canary.discord.com/channels/950850315601711176/1190458226861416498">here</a>.</sub>

</br>
</br>

#### Build & Deployment:
**Prerequisites:**
- Node.js (https://nodejs.org/)

**Setup:**  </br>
- **Clone the Repository:**  </br>
`git clone https://github.com/uchks/tf-observer.git`

- **Navigate to the Repository:** </br>
`cd tf-observer`

- **Install dependencies:** </br>
`npm install`

- **Create a `.env` file:** </br>
In the root of the repository, create a file named .env and add the following: </br>
```ts
BOT_TOKEN = // your bots token.
CHANNEL_ID = // channel id, must be a text or announcements channel.
GUILD_ID = // server id
CLIENT_ID = // discord developer portal, application's client id.
FETCH_URL = // this is where the CloudFlare worker comes into place, see How It Happened.
APP_NAME = Discord - Chat, Talk & Hangout // Discord's app name.
EMBED_COLOR = '' // the color for the embed
EMBED_THUMBNAIL_URL = 'https://is3-ssl.mzstatic.com/image/thumb/Purple116/v4/fa/bf/43/fabf4352-a22e-4f88-796a-5e4bae0c4688/AppIcon-0-0-1x_U007epad-0-0-0-85-220.png/1920x1080bb-80.png' // Discord's app icon.
DEV_MODE = false // true will reload commands on bot start every restart, false does not.
postgresconn = // i used postgres for the database, adjust to your liking
```

- **Build & Run:** </br>
`npm run build`
`npm run start`

#### How It Happened:  </br>
Due to some unfavorable... _things_, I decided to look into Testflight's API. I did this by using my iPhone and my computer. Introducing: [mitmproxy](https://github.com/mitmproxy/mitmproxy), a glorious utility that allows you to proxy requests from your phone. it was quite simple really. 
- launch mitmproxy
- find your local ipv4 address
- change your phone wifi settings to the address with port 8080
- go to https://mitm.it
- install the root cert
- enable the root cert
- and open testflight 

![Requests](https://unethicalcdn.com/private/requests.png)

Something that stood out to me was the `/v3/accounts/` request. I clicked on it. In front of me were request headers, alongside the full link. I took note of this, figuring it'd be of use later on.
![Request](https://unethicalcdn.com/private/request.png)

To the right of it, the response from the link.
![Response](https://unethicalcdn.com/private/response.png)

Below it, is the JSON response body. At the top of it being Life360, an app I have in my Testflight. From there, I opened the response body in notepad, and searched for Discord. 
![Response Body](https://unethicalcdn.com/private/responsebody.png)

This is where I knew I found exactly what I wanted. So what did I do? Make things way more complicated than necessary, I created a Cloudflare Worker to make the request from the headers I got earlier for me, and filtered out the json data to _only_ show me the Discord portion. and from there, the rest is history. 
![Cloudflare Worker](https://unethicalcdn.com/private/cfworker.png)

So here's the source code. I don't expect anyone to read a book, but in the case you were interested, here it is. 

### tf-observer
A discord bot that tracks whenever an update is released to Discord's TestFlight and sends an embed. </br>
Made for [Enmity](https://discord.gg/rMdzhWUaGT), a Discord client mod for iOS (and soon Android) devices.
You can view it in action in the "testflight-updates" channel, or [here](https://canary.discord.com/channels/950850315601711176/1190458226861416498).

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
BOT_TOKEN=your_discord_bot_token
CHANNEL_ID=your_discord_channel_id
FETCH_URL=your_cloudflare_worker_url // may or may not be applicable to you
```

- **Build & Run:** </br>
`npm run build && node dist/index.js`

#### How It Happened:  </br>
Due to some unfavorable _things_, I decided to look into Testflight's API. I did this by using my iPhone and my computer. Introducing: [mitmproxy](https://github.com/mitmproxy/mitmproxy), a glorious utility that allows you to proxy requests from your phone. it was quite simple really. 
- launch mitmproxy
- find your local ipv4 address
- change your phone wifi settings to the address with port 8080
- go to https://mitm.it
- install the root cert
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

The code for the bot itself is rather simple. I made sure to leave enough comments to make the codebase fairly understandable, even to the technologically inept.
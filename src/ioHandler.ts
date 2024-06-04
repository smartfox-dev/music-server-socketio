import { Socket } from "socket.io";

import OpenAIService from "./services/openai.service";
import AnthropicApi from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { ChatCompletion } from "openai/resources";
import { TextBlock } from "@anthropic-ai/sdk/resources";

dotenv.config();

const openai = OpenAIService;

const claudeApi = new AnthropicApi({
  apiKey: process.env.ANTHROPIC_API ?? "",
});

const geminiApi = new GoogleGenerativeAI(
  process.env.GOOGLE_GENERATIVE_AI_KEY ?? ""
);

const prompts = {
  chord: `Generate a chord sequence of one bar of chords (8th notes grid), in and with first chord representing mode (e.g., ii of C is Dmin_) = {mode} diatonic to key = {key} major, in genre = {genre}, chords and rhythm influenced by {composer} with mood {mood}. Notation: (1) chord letter with 'b' for flat, '#' for sharp, (2) must then always add and ONLY exact text ('maj' for major, or 'min' for minor, or 'dom' for dominant), (3) followed by ONLY limited to one of these three varied extension options (6,7,9). "~" extends previous note. Only match exact notation 1+2+3. Not more than 4 chords. Format: simple array with length {length}, no other text. E.g.: [Cmaj6,~,Gdom7,~,Amin9,Amin9,Fmaj7,~]`,
  melody: `Given chords {chords} (that are on an 8th note grid where "~" in array extends duration of prior chord), create a beautiful length = {length} also 8th note (same total length as chord array) diatonic melody compatible to each chord placement. with mood {mood}, influenced by {composer} in a two and a half octave range. Don't just run the scale, include leaps, and multiple journeys of ascend and descend. Include at least 3 "~" in cells following each note to extend duration of any previous notes. Format: simple MIDI array, no other text; E.g. (example in Gmaj) [43,~,50,~,59,60,62, ~]`,
  harmony: `Given chords {chords} (that are on 8th note grid where "~" in array extends duration of prior chord), Act as an Arpeggiator: generate a beautiful arrangement of length = {length} total chord tones (each 2 notes matching each chord and timing) in varying orders in a two and a half octave range. For the arpeggios "~" extends any previous note, "-" is a note rest. Include 2-5 triplets: notated two notes in one cell with "|" between them - e.g., [60|62,64] is a triplet of 60+62+64. Format: Simple MIDI array of total length {length}, no other text. Example format: [60, 64, 67, -, 72, ~, 60|64, 67, 60, -, 64, 60|67, 72, ~, 67, 64]`,
  rhythm: `Generate a complex rhythm in genre {genre} and mood {mood} influenced by composer {composer} in one array of 16th notes, with no other text. 1 = kick, 2 = snare, 3 = hat, 4 = open hat, 5 = ride. "-" is silence. Array length {length} entries between commas.  E.g. [1,-,3,3,2,3,-,3,1,3,1,3,2,3,-,3]`,
  instrument: `Select only from listed instruments from SGM by # very creatively for a musical composition based on genre = {genre}, influence = {composer}, and mood = {mood}. Return only simple array no other text of two values for three instruments for [Chords, Melody, Harmony], Example response [90, 48, 104].
    
  0 Piano 1
  4 E.Piano 1
  6 Harpsichord
  7 Clav.
  8 Celesta
  11 Vibraphone
  14 Tubular Bells
  15 Dulcimer
  16 Organ 1
  24 Nylon-str. Guitar
  25 Steel-str.Gt
  29 Overdrive Guitar
  30 Distortion Guitar
  32 Acoustic Bass
  33 Fingered Bass
  36 Slap Bass 1
  38 Synth Bass 1
  41 Viola
  42 Cello
  45 Pizzicato Strings
  46 Harp
  48 Strings
  61 Brass 1
  66 Tenor Sax
  73 Flute
  74 Recorder
  84 Charang
  86 5th Saw Wave
  88 Fantasia
  89 Warm Pad
  90 Polysynth
  97 Soundtrack
  98 Crystal
  104 Sitar
  106 Shamisen
  107 Koto
  114 Steel Drums`,
  audiogpt: "",
};

const getGPTResult = async ({
  type,
  genre,
  mode,
  composer,
  mood,
  length,
  key,
  chords,
  model,
}: {
  type: "chord" | "melody" | "harmony" | "rhythm" | "audiogpt" | "instrument";
  genre: string;
  mode: string;
  composer: string;
  mood: string;
  length: string;
  key: string;
  chords: string;
  model: string;
}) => {
  let data: any[] = [];
  const userMessage = {
    chord: `genre: ${genre}, mood: ${mood}, composer: ${composer}, key: ${key}, mode: ${mode}, length: ${length}`,
    melody: `mood: ${mood}, composer: ${composer}, key: ${key}, mode: ${mode}, chords: ${chords}, length: ${length}`,
    harmony: `key: ${key}, chords: ${chords}, length: ${length}`,
    rhythm: `genre: ${genre}, mood: ${mood}, composer: ${composer}`,
    audiogpt: `genre: ${genre}, mood: ${mood}, composer: ${composer}, key: ${key}, mode: ${mode}, chords: ${chords}`,
    instrument: `genre: ${genre}, mood: ${mood}, influence: ${composer}`,
  };

  let apiResponse;

  if (model === "4") {
    apiResponse = await openai.chat.completions.create({
      model: "gpt-4-32k",
      messages: [
        { role: "system", content: prompts[type] },
        { role: "user", content: userMessage[type] },
      ],
      temperature: 0.6,
    });
    if (!apiResponse) throw apiResponse;
    console.log("GPT-4 API Response:", apiResponse);

    if (
      apiResponse.choices &&
      apiResponse.choices[0] &&
      apiResponse.choices[0].message
    ) {
      const content = apiResponse.choices[0].message.content;
      console.log("GPT-4 Content:", content);
      try {
        data = JSON.parse(content ?? "");
        if (!Array.isArray(data)) {
          data = [content];
        }
      } catch (err) {
        console.log("Error parsing GPT-4 content:", err);
        data = [content];
      }
    }
  } else if (model === "C") {
    apiResponse = await claudeApi.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 1000,
      temperature: 0.0,
      messages: [
        { role: "user", content: `${prompts[type]}\n\n${userMessage[type]}` },
      ],
    });
    if (!apiResponse) throw apiResponse;
    if (
      apiResponse.content &&
      apiResponse.content[0] &&
      (apiResponse.content[0] as TextBlock).text
    ) {
      const content = apiResponse.content[0] as TextBlock;
      const messageContent = content.text;
      console.log("Claude Content:", messageContent);
      const trimmedContent = messageContent.replace(/^\[|\]$/g, "");
      data = trimmedContent.split(",").map((item: string) => item.trim());
    }
    console.log("Claude API Response:", apiResponse);
  } else if (model === "G") {
    const geminiModel = geminiApi.getGenerativeModel({ model: "gemini-pro" });
    apiResponse = await geminiModel.generateContent(
      `${prompts[type]}\n\n${userMessage[type]}`
    );
    if (!apiResponse) throw apiResponse;
    const response = await apiResponse.response;
    const messageContent = await response.text();
    console.log("Gemini API Response:", apiResponse);
    console.log("Gemini Content:", messageContent);

    const trimmedContent = messageContent.replace(/^\[|\]$/g, "");
    data = trimmedContent.split(",").map((item) => item.trim());
  } else {
    throw apiResponse;
  }

  console.log("Data:", data);
  if (data.length === 0) {
    console.log("No data received from the API");
    data = ["Error: No data received from the API"];
  }
  return data;
};

export default function handler(socket: Socket) {
  console.log("socket connected");
  socket.on("disconnect", () => {
    console.log("user disconnected");
  });
  socket.on("music", async (json_data) => {
    const { type, genre, composer, mode, mood, length, key, chords, model } =
      json_data;
    console.log("-------------json_data-----------", json_data);
    console.log("type:", type);
    console.log("genre:", genre);
    console.log("mode:", mode);
    console.log("composer:", composer);
    console.log("mood:", mood);
    console.log("length:", length);
    console.log("key:", key);
    console.log("chords:", chords);
    console.log("model:", model);
    let data = [];
    let instruments: any[] = [];
    let error = null;
    try {
      data = await getGPTResult({
        type,
        genre,
        mode,
        composer,
        mood,
        length,
        key,
        chords,
        model,
      });

      if (type == "chord") {
        instruments = await getGPTResult({
          type: "instrument",
          genre,
          mode,
          composer,
          mood,
          length,
          key,
          chords,
          model,
        });
      }
    } catch (err) {
      data = [];
      instruments = [];
      error = "Internal Server Error";
    }

    console.log(
      "------------response_data-------------:",
      JSON.stringify({
        param: {
          type,
          genre,
          mode,
          composer,
          mood,
          length,
          key,
          chords,
          model,
        },
        data,
        instruments,
        error,
      })
    );
    let response_data = JSON.stringify({
      param: { type, genre, mode, composer, mood, length, key, chords, model },
      data,
      instruments,
      error,
    });

    socket.emit("music_response", response_data);
  });
}

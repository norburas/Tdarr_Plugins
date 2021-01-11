/* eslint-disable */
module.exports.details = function details() {
  return {
    id: "Tdarr_Plugin_076a_transcode_additional_audio_codec_for_language",
    Stage: "Pre-processing",
    Name: "Create new audio codec",
    Type: "",
    Operation: "Transcode",
    Description: `Creates one! additional track for each specified language, from the specified input codecs. Everything else will be untouched!\\n
                  \\n
                  Description as code: \\n
                  \\n
                  for (let language in languages) { \\n
                    if (input_codecs.contains(output_codec, language)) { \\n
                      continue; \\n
                    } \\n
                    for (let input_codec in input_codecs) { \\n
                      if (input_codec.language == language) { \\n
                        createNewAudioTrack(input_codec, output_codec) \\n
                      } \\n
                      break; \\n
                    } \\n
                  } \\n
                 `,
    Version: "1.00",
    Link: "",
    Tags: "pre-processing,audio only,ffmpeg,configurable",
    Inputs: [
      {
        name: "languages",
        tooltip: `Specify languages that shall get a new audio track. (Plugin will handle all languages case-insensitive)\\n
                  Example: "en,english,ger,german,de"
                 `,
      },
      {
        name: "input_codecs",
        tooltip: `Specify input codecs that shall be used for as the source for the transcoding process.\\n
                  Example: "dts,eac3"           
                 `,
      },
      {
        name: "output_codec",
        tooltip: `Specify your desired output codec for each specified language.\\n
                  Example: "ac3"
                 `,
      },
    ],
  };
};

const doesCodecExistForLanguage = function (file, language, codec) {
  const match = file.ffProbeData.streams.find(function (stream) {
    if (stream.codec_type.toLowerCase() !== "audio") {
      return false;
    }
    return (
      stream.codec_name === codec &&
      stream.tags.language.toLowerCase() === language.toLowerCase()
    );
  });
  return match;
};

const getAudioStreamNumber = function (file, language, codec) {
  let audioStreamNumber = 0;

  for (let stream of file.ffProbeData.streams) {
    if (stream.codec_type.toLowerCase() !== "audio") {
      continue;
    } else {
      audioStreamNumber++;
    }

    if (
      stream.tags.language.toLowerCase() === language.toLowerCase() &&
      stream.codec_name === codec
    ) {
      break;
    }
  }

  return audioStreamNumber - 1;
};

module.exports.plugin = function plugin(file, librarySettings, inputs) {
  //Must return this object

  var ffmpeg = ", -map_metadata 0 -movflags use_metadata_tags -map 0 -c copy";
  var numberOfAudioStreams = 0;
  var numberOfTranscodingWorkloads = 0;

  var response = {
    processFile: false,
    preset: "",
    container: ".mp4",
    handBrakeMode: false,
    FFmpegMode: false,
    reQueueAfter: false,
    infoLog: "",
  };

  // check if all parameters are set
  if (
    inputs.languages === undefined ||
    inputs.input_codecs === undefined ||
    inputs.output_codec === undefined
  ) {
    response.processFile = false;
    response.infoLog = `${response.infoLog} Missing input options, either languages, input codecs or output codec are undefined! \n`;
    return response;
  }

  inputs.languages = inputs.languages.split(",");
  inputs.input_codecs = inputs.input_codecs.split(",");

  // check if file is a video || TODO: necessary?
  if (file.fileMedium !== "video") {
    response.processFile = false;
    response.infoLog += "File is not a video! \n";
    return response;
  }

  // get number of audio streams for later mapping
  file.ffProbeData.streams.forEach(function (stream) {
    if (stream.codec_type.toLowerCase() == "audio") {
      numberOfAudioStreams++;
    }
  });

  // print existing codecs and languages
  file.ffProbeData.streams.forEach(function (stream) {
    if (stream.codec_type.toLowerCase() !== "audio") {
      return;
    }
    response.infoLog = `${response.infoLog} Found existing codec "${stream.codec_name}" for language ${stream.tags.language}!\n`;
  });

  // start building the ffmpeg command
  inputs.languages.forEach(function (language) {
    // check if language already has the desired output codec, skip if true
    /*if (!doesCodecExistForLanguage(file, language, inputs.output_codec)) {
      response.infoLog = `${response.infoLog} Codec "${inputs.output_codec}" does already exist for language "${language}", skipping!\n`;
      return;
    }*/

    // add desired codec if it does not already exist
    // cycle through all input codecs, transcode the first one that exists
    // to the desired output codec
    for (let input_codec of inputs.input_codecs) {
      if (!doesCodecExistForLanguage(file, language, input_codec)) {
        response.infoLog = `${response.infoLog} Won't transcode input codec "${input_codec}" to output codec "${inputs.output_codec}", no matching input codecs found for language "${language}". Skipping!\n`;
        continue;
      }

      const audioStreamNumber = getAudioStreamNumber(
        file,
        language,
        input_codec
      );

      ffmpeg = `${ffmpeg} -map 0:a:${audioStreamNumber} -c:a:${numberOfAudioStreams} ${inputs.output_codec}`;
      numberOfAudioStreams++;

      // increase number of transcoding workloads, needed to show info log,
      // when nothing has to be done
      numberOfTranscodingWorkloads++;

      // break after match, prevents the plugin from adding one audio
      // stream per input codec
      break;
    }
  });

  if (numberOfTranscodingWorkloads > 0) {
    response.processFile = true;
  } else {
    response.processFile = false;
  }

  response.preset = ffmpeg;
  response.container = `.` + file.container;
  response.handBrakeMode = false;
  response.FFmpegMode = true;
  response.reQueueAfter = true;
  response.infoLog = `${response.infoLog} Plugin is done!\n`;
  return response;
};

(function($) {

  // ********************************************************************
  // * General Functions.
  // ********************************************************************

  // Create Drupal media recorder object.
  Drupal.mediaRecorder = Drupal.mediaRecorder || {};
  // Error callback.
  Drupal.mediaRecorder.onError = function(msg) {
    alert(msg);
  };
  // Field formatter callback.
  Drupal.mediaRecorder.fieldFormatter = function(element) {
    var language = Drupal.settings.mediaRecorder.language ? '[' + Drupal.settings.mediaRecorder.language + ']' : '';
    var delta = (Drupal.settings.mediaRecorder.delta !== null) ? '[' + Drupal.settings.mediaRecorder.delta + ']' : '';
    return Drupal.settings.mediaRecorder.fieldName + language + delta + '[' + element + ']';
  };

  // ********************************************************************
  // * HTML5 variables.
  // ********************************************************************

  Drupal.mediaRecorder.HTML5 = {};
  Drupal.mediaRecorder.HTML5.audioContext = null;
  Drupal.mediaRecorder.HTML5.recorder = null;
  Drupal.mediaRecorder.HTML5.audioInput = null;
  Drupal.mediaRecorder.HTML5.realAudioInput = null;
  Drupal.mediaRecorder.HTML5.inputPoint = null;
  Drupal.mediaRecorder.HTML5.rafID = null;
  Drupal.mediaRecorder.HTML5.analyserContext = null;
  Drupal.mediaRecorder.HTML5.canvasWidth = 300;
  Drupal.mediaRecorder.HTML5.canvasHeight = 100;

  // ********************************************************************
  // * WAMI Variables.
  // ********************************************************************

  Drupal.mediaRecorder.WAMI = {};

  // ********************************************************************
  // * HTML5 Audio Visualization Functions
  // ********************************************************************

  Drupal.mediaRecorder.HTML5.updateAnalysers = function (time) {
    if (!Drupal.mediaRecorder.HTML5.analyserContext) {
      var canvas = $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-analyser');
      Drupal.mediaRecorder.HTML5.canvasWidth = canvas[0].width;
      Drupal.mediaRecorder.HTML5.canvasHeight = canvas[0].height;
      Drupal.mediaRecorder.HTML5.analyserContext = canvas[0].getContext('2d');
    }
    var SPACING = 1;
    var BAR_WIDTH = 1;
    var numBars = Math.round(Drupal.mediaRecorder.HTML5.canvasWidth / SPACING);
    var freqByteData = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(freqByteData);
    Drupal.mediaRecorder.HTML5.analyserContext.clearRect(0, 0, Drupal.mediaRecorder.HTML5.canvasWidth, Drupal.mediaRecorder.HTML5.canvasHeight);
    Drupal.mediaRecorder.HTML5.analyserContext.fillStyle = '#F6D565';
    Drupal.mediaRecorder.HTML5.analyserContext.lineCap = 'round';
    var multiplier = analyserNode.frequencyBinCount / numBars;
    // Draw rectangle for each frequency bin.
    for (var i = 0; i < numBars; ++i) {
      var magnitude = 0;
      var offset = Math.floor(i * multiplier);
      // gotta sum/average the block, or we miss narrow-bandwidth spikes
      for (var j = 0; j < multiplier; j++)
      magnitude += freqByteData[offset + j];
      magnitude = magnitude / multiplier;
      var magnitude2 = freqByteData[i * multiplier];
      Drupal.mediaRecorder.HTML5.analyserContext.fillStyle = "hsl( " + Math.round((i * 360) / numBars) + ", 100%, 50%)";
      Drupal.mediaRecorder.HTML5.analyserContext.fillRect(i * SPACING, Drupal.mediaRecorder.HTML5.canvasHeight, BAR_WIDTH, -magnitude);
    }
    rafID = window.webkitRequestAnimationFrame(Drupal.mediaRecorder.HTML5.updateAnalysers);
  };

  // ********************************************************************
  // * HTML5 Recorder Functions
  // ********************************************************************

  // Setup media recorder.
  Drupal.mediaRecorder.HTML5.setup = function() {
    try {
      window.AudioContext = window.AudioContext || window.webkitAudioContext;
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia;
      window.URL = window.URL || window.webkitURL;
      Drupal.mediaRecorder.HTML5.audioContext = new AudioContext();
    } catch (e) {
      Drupal.mediaRecorder.onError('No web audio support in this browser!');
    }
    navigator.getUserMedia({audio: true}, Drupal.mediaRecorder.HTML5.startUserMedia, function(e) {});
  };
  // Initialize Stream Callback.
  Drupal.mediaRecorder.HTML5.startUserMedia = function(stream) {
    // Set input node.
    inputPoint = Drupal.mediaRecorder.HTML5.audioContext.createGainNode();
    realAudioInput = Drupal.mediaRecorder.HTML5.audioContext.createMediaStreamSource(stream);
    audioInput = realAudioInput;
    audioInput.connect(inputPoint);
    inputPoint.gain.value = 0.8;

    // Set analyzer node.
    analyserNode = Drupal.mediaRecorder.HTML5.audioContext.createAnalyser();
    analyserNode.fftSize = 2048;
    inputPoint.connect(analyserNode);
    
    // Create Recorder.
    Drupal.mediaRecorder.HTML5.recorder = new Recorder(inputPoint);

    // Set recorder gain.
    zeroGain = Drupal.mediaRecorder.HTML5.audioContext.createGainNode();
    zeroGain.gain.value = 0.0;
    inputPoint.connect(zeroGain);
    zeroGain.connect(Drupal.mediaRecorder.HTML5.audioContext.destination);
    
    // Update analyzer.
    Drupal.mediaRecorder.HTML5.updateAnalysers();
  };
  // Record callback.
  Drupal.mediaRecorder.HTML5.record = function() {
    Drupal.mediaRecorder.HTML5.recorder.record();
    Drupal.mediaRecorder.HTML5.recordStart();
  };
  // Start recording callback.
  Drupal.mediaRecorder.HTML5.recordStart = function() {
    Drupal.mediaRecorder.HTML5.recordDuring();
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record')
      .removeClass('record-off').addClass('record-on')
      .unbind('click').click(function() { Drupal.mediaRecorder.HTML5.stop(); });
  };
  // During recording callback.
  Drupal.mediaRecorder.HTML5.recordDuring = function() {
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').animate({opacity: 0.1}, 999);
    var currentSeconds = 0;
    var opacityValue = 1;
    recordInterval = setInterval(function() {
      // Set time limit and convert to date obj.
      currentSeconds = currentSeconds + 1;
      var currentMilliSeconds = new Date(currentSeconds * 1000);
      var currentMilliSecondsDate = new Date(currentMilliSeconds);
      // Stop recording if time limit is reached.
      if ((Drupal.settings.mediaRecorder.timeLimit - currentMilliSeconds) < 0) { Drupal.mediaRecorder.HTML5.stop(); }
      // Format Current Time
      var mm = currentMilliSecondsDate.getMinutes();
      var ss = currentMilliSecondsDate.getSeconds();
      // Set opacity value and animate.
      if (ss%2) {
        opacityValue = 1;
      } else {
        opacityValue = 0.1;
      }
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').animate({opacity: opacityValue}, 999);
      if (mm < 10) { mm = "0" + mm; }
      if (ss < 10) { ss = "0" + ss; }
      // Refresh time display with current time.
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html(mm + ':' + ss + ' / 05:00');
    }, 1000);
  };
  // Finish recording callback.
  Drupal.mediaRecorder.HTML5.recordFinish = function() {
    clearInterval(recordInterval);
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record')
      .removeClass('record-on').addClass('record-off')
      .animate({opacity: 1}, 1000).unbind('click')
      .click(function() { Drupal.mediaRecorder.HTML5.record(); });
  };
  // Stop recording callback.
  Drupal.mediaRecorder.HTML5.stop = function() {
    Drupal.mediaRecorder.HTML5.recordFinish();
    Drupal.mediaRecorder.HTML5.recorder.stop();
    Drupal.mediaRecorder.HTML5.recorder.exportWAV(function(blob) {
      var url = URL.createObjectURL(blob);
      var audio = $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-audio audio');
      $(audio).attr('src', url);
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html('<div class="progressbar"></div>');
      Drupal.mediaRecorder.HTML5.sendBlob(blob);
    });
    Drupal.mediaRecorder.HTML5.recorder.clear();
  };
  // Sends blob file using XHR.
  Drupal.mediaRecorder.HTML5.sendBlob = function(blob) {    
    var formData = new FormData();
    var fileObj = {};
    formData.append("mediaRecorder", blob);

    var req = new XMLHttpRequest();
    req.upload.onprogress = updateProgress;
    req.addEventListener("progress", updateProgress, false);
    req.addEventListener("load", transferComplete, false);
    req.addEventListener("error", transferFailed, false);
    req.addEventListener("abort", transferCanceled, false);
    req.open("POST", Drupal.settings.mediaRecorder.recordPath + '/' + Drupal.settings.mediaRecorder.fileName, true);
    req.send(formData);

    function updateProgress(evt) {
      if (evt.lengthComputable) {
        var percentComplete = (evt.loaded / evt.total) * 100;
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .progressbar').progressbar({value: percentComplete});
      } else {
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .progressbar').progressbar({value: 100});
      }
    }
    function transferComplete(evt) {
      var file = JSON.parse(req.response);
      var fidInput = Drupal.mediaRecorder.fieldFormatter('fid');
      var filepathInput = Drupal.mediaRecorder.fieldFormatter('media_recorder_filepath');
      $('input[name="' + fidInput + '"]').val(file.fid);
      $('input[name="' + filepathInput + '"]').val(Drupal.settings.mediaRecorder.filePath + '/' + Drupal.settings.mediaRecorder.fileName);
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html('00:00 / 05:00');
    }
    function transferFailed(evt) {
      Drupal.mediaRecorder.onError("An error occurred while transferring the file.");
    }
    function transferCanceled(evt) {
      Drupal.mediaRecorder.onError("The transfer has been canceled by the user.");
    }
  };
  
  // ********************************************************************
  // * WAMI Functions.
  // ********************************************************************

  // Initialize the Wami recorder.
  Drupal.mediaRecorder.WAMI.setup = function() {
    // Don't start WAMI unless div is present.
    // This is only an issue when wami is loaded by ajax. 
    findWamiInterval = setInterval(function() {
      if ($('#wami-' + Drupal.settings.mediaRecorder.cssid).length) {
        Wami.setup({
          id: 'wami-' + Drupal.settings.mediaRecorder.cssid,
          swfUrl: Drupal.settings.basePath + 'sites/all/libraries/wami/Wami.swf'
        });
        clearInterval(findWamiInterval);
      }
    }, 50);
  };
  // Record Callback.
  Drupal.mediaRecorder.WAMI.record = function() {
    Wami.startRecording(
      Drupal.settings.mediaRecorder.recordPath + '/' + Drupal.settings.mediaRecorder.fileName,
      Wami.nameCallback(Drupal.mediaRecorder.WAMI.recordStart),
      Wami.nameCallback(Drupal.mediaRecorder.WAMI.recordFinish),
      Wami.nameCallback(Drupal.mediaRecorder.onError)
    );
  };
  // Start recording callback.
  Drupal.mediaRecorder.WAMI.recordStart = function() {
    Drupal.mediaRecorder.WAMI.recordDuring();
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record')
      .removeClass('record-off').addClass('record-on')
      .unbind('click').click(function() { Drupal.mediaRecorder.WAMI.stop(); });
  };
  // During recording callback.
  Drupal.mediaRecorder.WAMI.recordDuring = function() {
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').animate({opacity: 0.1}, 999);
    var currentSeconds = 0;
    var opacityValue = 1;
    recordInterval = setInterval(function() {
      // Set time limit and convert to date obj.
      currentSeconds = currentSeconds + 1;
      var currentMilliSeconds = new Date(currentSeconds * 1000);
      var currentMilliSecondsDate = new Date(currentMilliSeconds);
      // Stop recording if time limit is reached.
      if ((Drupal.settings.mediaRecorder.timeLimit - currentMilliSeconds) < 0) { Drupal.mediaRecorder.WAMI.stop(); }
      // Format Current Time
      var mm = currentMilliSecondsDate.getMinutes();
      var ss = currentMilliSecondsDate.getSeconds();
      // Set opacity value and animate.
      if (ss%2) {
        opacityValue = 1;
      } else {
        opacityValue = 0.1;
      }
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').animate({opacity: opacityValue}, 999);
      if (mm < 10) { mm = "0" + mm; }
      if (ss < 10) { ss = "0" + ss; }
      // Refresh time display with current time.
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html(mm + ':' + ss + ' / 05:00');
    }, 1000);
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-analyser').replaceWith('<div class="media-recorder-analyser"></div>');
    meterInterval = setInterval(function() {
      // Refresh meter bar.
      var level = Wami.getRecordingLevel();
      var marginTop = Math.round(( 100 - level ) / 2);
      if (level === 0) { level = 1; }
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-analyser').append('<div class="meter-bar"><div class="inner record" style="height:' + level + '%; margin-top: ' + marginTop + 'px"></div></div>');
      var barsNumber = $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-analyser').children().size();
      if (barsNumber >= 100) {
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-analyser').children().first().remove();
      }
    }, 50);
  };
  // Stop recording callback.
  Drupal.mediaRecorder.WAMI.recordFinish = function() {
    var time = new Date().getTime(); // Adds time to audio url to disable caching.
    var url = Drupal.settings.mediaRecorder.url + '/' + Drupal.settings.mediaRecorder.fileName;
    var audio = $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-audio audio');
    var elementName = Drupal.mediaRecorder.fieldFormatter('media_recorder_filepath');
    // Clear all recording intervals.
    clearInterval(recordInterval);
    clearInterval(progressInterval);
    clearInterval(meterInterval);
    // Set audio and file input values.
    $(audio).attr('src', url + '?' + time);
    $('input[name="' + elementName + '"]').val(Drupal.settings.mediaRecorder.filePath + '/' + Drupal.settings.mediaRecorder.fileName);
    // Change recorder HTML/CSS.
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record')
      .removeClass('record-on').addClass('record-off')
      .unbind('click').click(function() { Drupal.mediaRecorder.WAMI.record(); });
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html('00:00 / 05:00');
    $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').animate({opacity: 1}, 1000);
  };
  // Stop recording callback.
  Drupal.mediaRecorder.WAMI.stop = function() {
    Wami.stopRecording();
    var progressCount = 0;
    var progressIndicator = '';
    progressInterval = setInterval(function() {
      progressCount = progressCount + 1;
      progressIndicator = progressIndicator + '.';
      $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-status').html('Uploading' + progressIndicator);
      if (progressCount === 3) { progressCount = 0; progressIndicator = ''; }
    }, 500);
  };

  // ********************************************************************
  // * Drupal Attach Behaviors.
  // ********************************************************************

  // Add setup to drupal behaviors.
  Drupal.behaviors.mediaRecorder = {
    attach: function() {
      
      // Hides all media widget file fields.
      var mediaRecorder = $('.media-recorder-wrapper');
      mediaRecorder.each(function(){
        var width = $(this).attr('width') + 'px';
        var height = $(this).attr('height') + 'px';
        $(this).find('.media-recorder').css({'width': width, 'height': height});
      });
      
      // Hides all media widget file fields.
      var mediaRecorderFields = $('.field-widget-media-recorder .form-type-managed-file');
      mediaRecorderFields.each(function(){
        $(this).find('.form-managed-file').hide();
        $(this).find('.description').hide();
      });
      
      // Check if form has been submitted and prepopulate audio source.
      var filepathInput = Drupal.mediaRecorder.fieldFormatter('media_recorder_filepath');
      $('input[name="' + filepathInput + '"]').each(function(){
        // Set audio and file input values.
        if ($(this).val()) {
          var url = Drupal.settings.mediaRecorder.url + '/' + Drupal.settings.mediaRecorder.fileName;
          var time = new Date().getTime(); // Adds time to audio url to disable caching.
          var audio = $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-audio audio');
          $(audio).attr('src', url + '?' + time);
        }
      });
      
      // Load HTML5 recorder.
      if (navigator.getUserMedia || navigator.webkitGetUserMedia) {
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder').addClass('HTML5');
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').click(function() {
          Drupal.mediaRecorder.HTML5.record();
        });
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .volume').slider({
          orientation: "vertical",
          range: "min",
          step: 0.05,
          min: 0,
          max: 1,
          value: 0.8,
          slide: function(event, ui) {
            inputPoint.gain.value = ui.value;
          }
        });
        Drupal.mediaRecorder.HTML5.setup();
      }
      
      // Load HTML5 recorder.
      else if (window.Wami) {
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder')
          .addClass('WAMI')
          .append('<div class="media-recorder-mic-settings"><span>Settings</span></div>')
          .prepend('<div id="wami-' + Drupal.settings.mediaRecorder.cssid + '"></div><input id="wami-filepath" type="hidden">');
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-record').click(function() {
          Drupal.mediaRecorder.WAMI.record();
        });
        $('#' + Drupal.settings.mediaRecorder.cssid + ' .media-recorder-mic-settings').click(function() {
          Wami.showSecurity("microphone");
        });
        Drupal.mediaRecorder.WAMI.setup();
      }
    }
  };

})(jQuery);
import { RECORDING_ERRORS } from '@chirpy/shared';

let activeAudioContext: AudioContext | null = null;

export async function captureDisplayMedia(): Promise<MediaStream> {
  try {
    const displayStream = await navigator.mediaDevices.getDisplayMedia({
      video: {
        frameRate: { ideal: 30, max: 30 },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        sampleRate: 44100,
      },
    });

    const videoTracks = displayStream.getVideoTracks();
    const displayAudioTracks = displayStream.getAudioTracks();

    let micStream: MediaStream | null = null;
    try {
      micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch {
      /* microphone is optional */
    }

    const micAudioTracks = micStream?.getAudioTracks() ?? [];
    const combinedTracks: MediaStreamTrack[] = [...videoTracks];

    if (displayAudioTracks.length > 0 && micAudioTracks.length > 0) {
      activeAudioContext?.close();
      activeAudioContext = new AudioContext();
      const destination = activeAudioContext.createMediaStreamDestination();

      const tabSource = activeAudioContext.createMediaStreamSource(
        new MediaStream([displayAudioTracks[0]!]),
      );
      tabSource.connect(destination);

      const micSource = activeAudioContext.createMediaStreamSource(
        new MediaStream([micAudioTracks[0]!]),
      );
      micSource.connect(destination);

      combinedTracks.push(...destination.stream.getAudioTracks());
    } else if (displayAudioTracks.length > 0) {
      combinedTracks.push(...displayAudioTracks);
    } else if (micAudioTracks.length > 0) {
      combinedTracks.push(...micAudioTracks);
    }

    micStream?.getTracks().forEach((track) => {
      if (!combinedTracks.includes(track)) track.stop();
    });

    const finalStream = new MediaStream(combinedTracks);

    return finalStream;
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'NotAllowedError') throw new Error(RECORDING_ERRORS.PERMISSION_DENIED);
      if (err.name === 'NotSupportedError') throw new Error(RECORDING_ERRORS.NOT_SUPPORTED);
    }
    throw new Error(RECORDING_ERRORS.UNKNOWN);
  }
}

export function getSupportedMimeType(): string {
  const candidates = [
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function stopStream(stream: MediaStream): void {
  stream.getTracks().forEach((track) => track.stop());
  if (activeAudioContext) {
    void activeAudioContext.close();
    activeAudioContext = null;
  }
}

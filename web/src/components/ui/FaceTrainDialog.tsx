import { useState, useRef, useEffect, useCallback } from "react";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ScanFace } from "lucide-react";
import {
  Dialog, DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";

export function FaceTrainDialog({
  open,
  onOpenChange,
  userId,
  onComplete
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  onComplete: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [training, setTraining] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const startCamera = async () => {
    try {
      setErrorMsg(null);
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err: any) {
      setErrorMsg("Camera access denied or not available. " + err.message);
    }
  };

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    if (open) {
      startCamera();
      setSuccess(false);
      setErrorMsg(null);
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [open]);

  const captureAndTrain = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setTraining(true);
    setErrorMsg(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to Blob
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setErrorMsg("Failed to capture image.");
        setTraining(false);
        return;
      }
      
      try {
        const formData = new FormData();
        formData.append("file", blob, "face.jpg");
        
        // Call Python AI Service
        const res = await fetch(`http://localhost:8082/api/face/train/${userId}`, {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.detail || "Training failed");
        }
        
        setSuccess(true);
        toast.success("Face Trained Successfully!");
        setTimeout(() => {
          onOpenChange(false);
          onComplete();
        }, 2000);
        
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to connect to AI service");
        setTraining(false);
      }
    }, "image/jpeg");
  };

  return (
    <Dialog open={open} onClose={() => { onOpenChange(false); onComplete(); }} className="sm:max-w-md">
      <DialogHeader
        title="Train Employee Face"
        description="Capture the employee's face for future punch-in verification."
      />

      <div className="flex flex-col items-center justify-center space-y-4 py-4">
          {success ? (
            <div className="flex flex-col items-center text-success py-8">
              <CheckCircle2 className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Face Registered Successfully!</p>
            </div>
          ) : (
            <>
              <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-border shadow-inner">
                {!stream && !errorMsg && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <RefreshCw className="h-8 w-8 text-muted-foreground animate-spin" />
                  </div>
                )}
                {errorMsg && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center bg-destructive/10">
                    <AlertCircle className="h-8 w-8 text-destructive mb-2" />
                    <p className="text-sm text-destructive font-medium">{errorMsg}</p>
                    <Button variant="outline" size="sm" className="mt-4" onClick={startCamera}>
                      Try Again
                    </Button>
                  </div>
                )}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover ${stream && !errorMsg ? "block" : "hidden"}`}
                />
                <canvas ref={canvasRef} className="hidden" />
                
                {stream && !errorMsg && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-primary/50 m-8 rounded-full border-dashed" />
                )}
              </div>

              {stream && !errorMsg && (
                <div className="flex w-full gap-2">
                  <Button 
                    variant="outline"
                    className="w-1/3"
                    onClick={() => { onOpenChange(false); onComplete(); }}
                    disabled={training}
                  >
                    Skip
                  </Button>
                  <Button 
                    onClick={captureAndTrain} 
                    disabled={training}
                    className="w-2/3 h-10"
                  >
                    {training ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Registering...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" /> Capture & Train
                      </>
                    )}
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
    </Dialog>
  );
}

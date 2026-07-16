import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, RefreshCw, CheckCircle2, AlertCircle, ScanFace } from "lucide-react";
import {
  Dialog, DialogHeader,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import toast from "react-hot-toast";
import { api } from "@/lib/api";

export function FacePunchDialog({
  open,
  onOpenChange,
  userId,
  isPunchIn,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: number;
  isPunchIn: boolean;
}) {
  const queryClient = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [verifying, setVerifying] = useState(false);
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

  const punchMutation = useMutation({
    mutationFn: async () => {
      // Get location if possible
      let lat = null, lng = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => 
          navigator.geolocation.getCurrentPosition(resolve, reject)
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch (e) {
        console.warn("Location not available", e);
      }
      
      const req = {
        mode: "FACE_VERIFIED",
        latitude: lat,
        longitude: lng
      };
      
      const endpoint = isPunchIn ? "/attendance/punch-in" : "/attendance/punch-out";
      await api.post(endpoint, req);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dashboard", "me"] });
      queryClient.invalidateQueries({ queryKey: ["attendance", "my-records"] });
      setSuccess(true);
      toast.success(isPunchIn ? "Punched In Successfully!" : "Punched Out Successfully!");
      setTimeout(() => onOpenChange(false), 2000);
    },
    onError: (err: any) => {
      setErrorMsg(err.response?.data?.message || "Failed to mark attendance.");
    }
  });

  const captureAndVerify = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    setVerifying(true);
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
        setVerifying(false);
        return;
      }
      
      try {
        const formData = new FormData();
        formData.append("file", blob, "face.jpg");
        
        // Call Python AI Service
        const res = await fetch(`http://localhost:8082/api/face/verify/${userId}`, {
          method: "POST",
          body: formData,
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.detail || "Verification failed");
        }
        
        if (data.match) {
          // Face matched! Now mark attendance
          punchMutation.mutate();
        } else {
          setErrorMsg("Face does not match. Please try again.");
          setVerifying(false);
        }
        
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to connect to AI service");
        setVerifying(false);
      }
    }, "image/jpeg");
  };

  return (
    <Dialog open={open} onClose={() => onOpenChange(false)} className="sm:max-w-md">
      <DialogHeader
        title="Face Verification"
        description={`Look directly at the camera to ${isPunchIn ? 'punch in' : 'punch out'}.`}
      />

      <div className="flex flex-col items-center justify-center space-y-4 py-4">
          {success ? (
            <div className="flex flex-col items-center text-success py-8">
              <CheckCircle2 className="h-16 w-16 mb-4" />
              <p className="text-lg font-medium">Verified Successfully!</p>
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
                <Button 
                  onClick={captureAndVerify} 
                  disabled={verifying}
                  className="w-full h-12 text-md"
                >
                  {verifying ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Verifying Face...
                    </>
                  ) : (
                    <>
                      <Camera className="mr-2 h-5 w-5" /> Capture & Verify
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
    </Dialog>
  );
}

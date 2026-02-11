import { motion } from "framer-motion";
import robotFaceImg from "@assets/generated_images/friendly_robot_face_illustration.png";

export function RobotFace({ className = "" }: { className?: string }) {
  return (
    <div className={`flex justify-center items-center ${className}`}>
      <motion.div
        animate={{
          y: [0, -10, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative"
      >
        <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-150 opacity-50" />
        <img
          src={robotFaceImg}
          alt="Robot Face"
          className="w-48 h-48 md:w-64 md:h-64 object-contain relative z-10 drop-shadow-2xl"
          data-testid="img-robot-face"
        />
      </motion.div>
    </div>
  );
}

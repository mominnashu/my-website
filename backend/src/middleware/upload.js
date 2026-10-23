import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (["image/png", "image/jpeg", "image/webp"].includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(Object.assign(new Error("Upload a PNG, JPEG or WebP image"), { statusCode: 422 }), false);
  }
};

export const upload = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB max
  },
  fileFilter,
});

export const uploadSingleImage = upload.single("image");

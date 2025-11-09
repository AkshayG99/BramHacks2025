# Model Files Setup

## Large Model File Not Included

The PyTorch model file `wildfire_detector_best.pth` (182MB) is too large for GitHub and is excluded from the repository.

## How to Get the Model File

### Option 1: Download from External Source
If you have the model hosted elsewhere:
```bash
# Download from your storage (Google Drive, Dropbox, etc.)
# Place it in the root directory: /Users/roshaniruku/code/BramHacks2025/
wget YOUR_MODEL_URL -O wildfire_detector_best.pth
```

### Option 2: Use Git LFS (Large File Storage)

If you want to track large files in the future:

1. **Install Git LFS**:
```bash
# macOS
brew install git-lfs

# Or download from: https://git-lfs.github.com/
```

2. **Initialize Git LFS**:
```bash
git lfs install
```

3. **Track large files**:
```bash
git lfs track "*.pth"
git lfs track "*.pt"
git add .gitattributes
git commit -m "Track model files with Git LFS"
```

4. **Add your model**:
```bash
git add wildfire_detector_best.pth
git commit -m "Add model file via LFS"
git push
```

## Alternative: Model Storage Solutions

For large model files, consider:

- **Hugging Face Hub**: https://huggingface.co/docs/hub/models-uploading
- **Google Drive**: Share with team via link
- **AWS S3 / Google Cloud Storage**: For production deployments
- **DVC (Data Version Control)**: https://dvc.org/

## Current Setup

The `.gitignore` now excludes:
- `*.pth` - PyTorch model files
- `*.pt` - PyTorch checkpoint files
- `*.onnx` - ONNX model files
- `*.h5` - Keras/TensorFlow model files
- `*.pb` - TensorFlow protobuf files

## For New Team Members

1. Clone the repository
2. Download the model file from the team's shared storage
3. Place it in the project root directory
4. Run the application - it should detect the model automatically

## Note

The model file is required for the wildfire detection feature to work. Without it, the CV detection functionality will not operate.

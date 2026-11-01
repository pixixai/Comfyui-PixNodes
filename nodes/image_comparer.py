import os
import uuid

import av
import torch

from comfy_api.latest import Input, Types
from nodes import PreviewImage


class ComparisonViewer(PreviewImage):
    """Preview and compare images or videos."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {
                "foreground_image": ("IMAGE,VIDEO",),
                "background_image": ("IMAGE,VIDEO",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    OUTPUT_NODE = True
    CATEGORY = "PixNodes"
    FUNCTION = "compare_images"
    
    NODE_NAME = "Pix_ComparisonViewer"
    DISPLAY_NAME = "Comparison Viewer"
    DESCRIPTION = "Compare images and videos with a sliding divider and synchronized video controls."

    def compare_images(self,
                     foreground_image=None,
                     background_image=None,
                     filename_prefix="pix.compare.",
                     prompt=None,
                     extra_pnginfo=None):

        return {
            "ui": {
                "a_images": self._preview_media(foreground_image, filename_prefix, prompt, extra_pnginfo),
                "b_images": self._preview_media(background_image, filename_prefix, prompt, extra_pnginfo),
            }
        }

    def _preview_media(self, media, filename_prefix, prompt, extra_pnginfo):
        if media is None:
            return []

        if isinstance(media, torch.Tensor):
            if len(media) == 0:
                return []
            saved = self.save_images(media, filename_prefix, prompt, extra_pnginfo)
            return [{**image, "media_type": "image"} for image in saved["ui"]["images"]]

        if not isinstance(media, Input.Video):
            raise TypeError("Comparison Viewer expects an IMAGE tensor or a VIDEO object.")

        filename = f"pix.compare.{uuid.uuid4().hex}.mp4"
        path = os.path.join(self.output_dir, filename)
        media.save_to(path, format=Types.VideoContainer.MP4, codec=Types.VideoCodec.H264, preset="fast")
        with av.open(path) as container:
            stream = container.streams.video[0]
            fps = float(stream.average_rate or stream.guessed_rate)
            has_audio = bool(container.streams.audio)

        return [{
            "filename": filename,
            "subfolder": "",
            "type": self.type,
            "media_type": "video",
            "fps": fps,
            "has_audio": has_audio,
        }]


NODE_CLASS_MAPPINGS = {
    "Pix_ComparisonViewer": ComparisonViewer
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "Pix_ComparisonViewer": "Comparison Viewer"
}

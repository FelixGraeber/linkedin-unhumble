import json
import requests
import os
import base64
import logging
from flask import Flask, jsonify, request
from flask_cors import CORS
import anthropic
import httpx
from PIL import Image
from io import BytesIO

# Initialize Flask app
app = Flask(__name__)

# Set logger level to DEBUG
app.logger.setLevel(logging.DEBUG)

# Apply CORS to all domains on all routes, allowing all headers and methods.
CORS(app)

def prepare_image(image_url):
    """Fetch, resize, convert to JPEG, and base64 encode the image."""
    try:
        image_media_type = "image/jpeg"
        # Directly parse the image URL to base64, simulating the fetch and encode process
        image_data = base64.b64encode(httpx.get(image_url).content).decode("utf-8")
        # # Assuming the URL directly points to an image, simulate loading it into PIL for processing
        # image = Image.open(BytesIO(base64.b64decode(image_data)))
        # # Resize image, maintaining aspect ratio
        # base_width = 250
        # w_percent = (base_width / float(image.size[0]))
        # h_size = int((float(image.size[1]) * float(w_percent)))
        # image = image.resize((base_width, h_size), Image.Resampling.LANCZOS)
        # # Convert image to PNG and encode to base64
        # image_converted = BytesIO()
        # image.save(image_converted, format="PNG")
        # image_data_png = base64.b64encode(image_converted.getvalue()).decode("utf-8")
        # image_media_type = "image/png"
        return image_data, image_media_type
    except Exception as e:
        app.logger.debug("Failed to prepare image: %s", str(e))
        return None, None

@app.route('/test', methods=['POST'])
def test():
    app.logger.debug("Test request received!")
    return jsonify({"status": "success", "message": "Simplified response"}), 200

@app.route('/classify_image', methods=['POST', 'OPTIONS'])
def classify_image():
    app.logger.debug("Request received: %s", request.method)
    if request.method == 'POST':
        app.logger.debug("Handling POST")
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        try:
            model = data.get('data', {}).get('model', 'claude-3-opus-20240229')
            messages = data.get('data', {}).get('messages', [])
            app.logger.debug("Messages: %s", messages)
            app.logger.debug("Model: %s", model)

            if messages:
                first_message = messages[0]
                image_url = first_message.get('content', [])[0].get('source', {}).get('url')
                classification_request = first_message.get('content', [])[1].get('text')
                app.logger.debug("Image URL: %s", image_url)
                app.logger.debug("Classification Request: %s", classification_request)

                image_data, image_media_type = prepare_image(image_url)
                if image_data and image_media_type:
                    client = anthropic.Anthropic(api_key="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")
                    try:
                        response = client.messages.create(
                            model=model,
                            max_tokens=1024,
                            messages=[
                                {
                                    "role": "user",
                                    "content": [
                                        {
                                            "type": "image",
                                            "source": {
                                                "type": "base64",
                                                "media_type": image_media_type,
                                                "data": image_data,
                                            },
                                        },
                                        {
                                            "type": "text",
                                            "text": "describe the image"
                                        }
                                    ],
                                }
                            ],
                        )
                        app.logger.debug("Response: %s", response)
                        # Convert the Message object to a dictionary
                        response_dict = {
                            "id": response.id,
                            "content": [{"text": block.text, "type": block.type} for block in response.content],
                            "model": response.model,
                            "role": response.role,
                            "stop_reason": response.stop_reason,
                            "type": response.type,
                            "usage": {
                                "input_tokens": response.usage.input_tokens,
                                "output_tokens": response.usage.output_tokens
                            }
                        }

                        return jsonify(response_dict), 200
                    except Exception as e:
                        # This catches exceptions thrown by the anthropic client, which might indicate errors like network issues or invalid parameters.
                        return jsonify({"error": str(e)}), 500
                else:
                    return jsonify({"error": "Failed to prepare image"}), 500
            else:
                return jsonify({"error": "No messages found in payload"}), 400
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    return jsonify({"error": "Method not allowed"}), 405

@app.route('/')
def home():
    return jsonify({"message": "Welcome to the Flask API!"}), 200

if __name__ == '__main__':
    app.logger.debug("Server is running... Hello World!")
    app.run(port=50001, debug=True)
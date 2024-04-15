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
    image_response = requests.get(image_url)
    if image_response.status_code == 200:
        # Load image into PIL
        image = Image.open(BytesIO(image_response.content))
        # Resize image, maintaining aspect ratio
        base_width = 250
        w_percent = (base_width / float(image.size[0]))
        h_size = int((float(image.size[1]) * float(w_percent)))
        image = image.resize((base_width, h_size), Image.Resampling.LANCZOS)
        # Convert image to JPEG
        image_converted = BytesIO()
        image.save(image_converted, format="JPEG")
        # Encode to base64
        image_data = base64.b64encode(image_converted.getvalue()).decode("utf-8")
        image_media_type = "image/jpeg"
        return image_data, image_media_type
    else:
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
                                            "text": classification_request
                                        }
                                    ],
                                }
                            ],
                        )
                        app.logger.debug("Response: %s", response)
                        return jsonify(response), 200
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
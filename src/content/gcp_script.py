import os
from flask import Flask, jsonify, request
from flask_cors import CORS
import anthropic
import base64
import requests
from PIL import Image
import io

# Initialize Flask app
app = Flask(__name__)

# Apply CORS to all domains on all routes, allowing all headers and methods.
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


def prepare_image(image_url):
    """Fetch, resize to 250px on the longer side, convert to JPEG, and base64 encode the image."""
    try:
        image_media_type = "image/jpeg"
        response = requests.get(image_url)
        # Open the image using BytesIO
        image = Image.open(io.BytesIO(response.content))
        # Calculate new size, keeping the aspect ratio
        if image.width > image.height:
            new_height = int((250 / image.width) * image.height)
            new_size = (250, new_height)
        else:
            new_width = int((250 / image.height) * image.width)
            new_size = (new_width, 250)
        # Resize the image
        resized_image = image.resize(new_size, Image.Resampling.LANCZOS)  # Updated to use Image.Resampling.LANCZOS
        # Convert the image to JPEG
        with io.BytesIO() as output:
            resized_image.save(output, format="JPEG")
            jpeg_data = output.getvalue()
        # Base64 encode the JPEG image
        image_data = base64.b64encode(jpeg_data).decode("utf-8")
        return image_data, image_media_type
    except Exception as e:
        print("Failed to prepare image: %s" % str(e))
        return None, None

@app.route('/classify_image', methods=['POST'])
def classify_image(request):
    # Use Flask's global request object directly
    print("Request received: %s" % request.method)
    if request.method == 'POST':
        print("Handling POST")
        data = request.get_json()
        if not data:
            return jsonify({"error": "No JSON payload provided"}), 400

        try:
            model = data.get('data', {}).get('model', 'claude-3-opus-20240229')
            messages = data.get('data', {}).get('messages', [])
            print("Messages: %s" % messages)
            print("Model: %s" % model)

            if messages:
                first_message = messages[0]
                image_url = first_message.get('content', [])[0].get('source', {}).get('url')
                classification_request = first_message.get('content', [])[1].get('text')
                print("Image URL: %s" % image_url)
                print("Classification Request: %s" % classification_request)

                image_data, image_media_type = prepare_image(image_url)
                if image_data and image_media_type:
                    client = anthropic.Anthropic(api_key=os.getenv('API_KEY'))
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
                        print("Response: %s" % response)
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

@app.errorhandler(Exception)
def handle_unexpected_error(error):
    """Global error handler."""
    response = jsonify({'message': 'An unexpected error occurred', 'details': str(error)})
    response.status_code = 500
    return response

def main():
    print("Received request at main entry point.")
    return app


if __name__ == '__main__':
    print("Server is running...")
    app.run(port=50001, debug=True)
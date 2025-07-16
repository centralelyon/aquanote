# ml-cycle-predictor-js

## Overview
The `ml-cycle-predictor-js` project implements a machine learning model for predicting the next cycle in a swimming context. The model is designed to be used in a JavaScript environment, allowing for easy integration into web applications.

## Project Structure
```
ml-cycle-predictor-js
├── model
│   ├── best_model.json        # Serialized best AI model for predictions
│   └── model_stats.json       # Model performance statistics
├── js
│   ├── predictor.js           # Class for loading model and making predictions
│   └── utils.js               # Utility functions for data processing
├── data
│   └── sample_input.json      # Sample input data for testing
└── README.md                  # Project documentation
```

## Files Description

### Model
- **best_model.json**: Contains the serialized architecture and weights of the best-performing AI model used for predicting the next cycle.
- **model_stats.json**: Stores performance metrics of the model, including:
  - Percentage of exact predictions
  - Percentage of predictions within 1 frame
  - Additional relevant statistics

### JavaScript
- **predictor.js**: Exports the `CyclePredictor` class, which includes methods for:
  - `loadModel`: Loads the AI model from `best_model.json`.
  - `predictNextCycle`: Makes predictions based on input data.
  - `getModelStats`: Retrieves model performance statistics from `model_stats.json`.

- **utils.js**: Exports utility functions for:
  - `normalizeInput`: Preprocesses input data for the model.
  - `denormalizeOutput`: Converts model output back to the original scale.

### Data
- **sample_input.json**: Contains sample input data in JSON format for testing the model's prediction capabilities.

## Usage
1. Load the model using the `CyclePredictor` class from `predictor.js`.
2. Use the `predictNextCycle` method to make predictions based on input data.
3. Access model performance statistics using the `getModelStats` method.

## Setup Instructions
1. Clone the repository.
2. Ensure you have a JavaScript environment set up (Node.js or browser).
3. Include the `predictor.js` and `utils.js` files in your project.
4. Load the model and start making predictions using the provided methods.

## License
This project is licensed under the MIT License. See the LICENSE file for details.
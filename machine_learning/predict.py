import numpy as np
import tensorflow as tf

def test_crops_yield_model(model_path, feature_array, feature_mean_path="models/feature_mean.npy", feature_std_path="models/feature_std.npy", label_mean_path="models/label_mean.npy", label_std_path="models/label_std.npy"):
    """
    Loads a trained model and tests it on given features.

    Parameters:
        model_path (str): Path to the saved Keras model (.keras).
        feature_array (np.ndarray): Raw input features (unscaled) for testing.
        feature_mean_path (str): Path to saved feature mean (numpy).
        feature_std_path (str): Path to saved feature std (numpy).
        label_mean_path (str): Path to saved label mean (numpy).
        label_std_path (str): Path to saved label std (numpy).

    Returns:
        predictions_rescaled (np.ndarray): Model predictions rescaled to original units.
    """
    # Load saved model
    model = tf.keras.models.load_model(model_path)

    # Load feature and label scaling stats
    feature_mean = np.load(feature_mean_path)
    feature_std = np.load(feature_std_path)
    label_mean = np.load(label_mean_path)
    label_std = np.load(label_std_path)

    # Scale features
    features_scaled = (feature_array - feature_mean) / feature_std

    # Predict
    predictions_scaled = model.predict(features_scaled)

    # Rescale predictions to original units
    predictions_rescaled = predictions_scaled * label_std + label_mean
    return predictions_rescaled

# --- Example usage ---
if __name__ == "__main__":
    sample_features = np.array([
        [
            2,      # crop_type: WHEAT
            39.0,   # soil_moisture_%
            5.5,    # soil_pH
            22.0,   # temperature_C
            120.0,  # rainfall_mm
            15.0,   # humidity_%
            1.0,    # sunlight_hours
            2,      # irrigation_type: SPRINKLER
            1,      # fertilizer_type: ORGANIC
            50.0,   # pesticide_usage_ml
            120.0,  # total_days (sowing→harvest)
            0.72,   # NDVI_index
            1,      # crop_disease_status: NONE
            3,      # sowing_month (August)
            8,      # harvest_month (August)
        ]
    ], dtype="float32")

    # --- Predict ---
    predicted_yield = test_crops_yield_model(
        "models/argon.keras",
        sample_features
    )

    print("Predicted yield (kg/ha):", predicted_yield.flatten())
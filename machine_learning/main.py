import pandas as pd
import numpy as np
from enum import Enum

# Make numpy values easier to read.
np.set_printoptions(precision=3, suppress=True)

import tensorflow as tf
print("TensorFlow version:", tf.__version__)

from tensorflow.keras.layers import Dense, Flatten, Conv2D
from tensorflow.keras import Model
from tensorflow.keras import layers

class CropType(Enum):
    WHEAT = 1
    RICE = 2
    MAIZE = 3
    COTTON = 4
    SOYBEAN = 5

class IrrigationType(Enum):
    DRIP = 1
    SPRINKLER = 2
    MANUAL = 3
    NONE = 4

class FertilizerType(Enum):
    ORGANIC = 1
    INORGANIC = 2
    MIXED = 3

class CropDiseaseStatus(Enum):
    NONE = 1
    MILD = 2
    MODERATE = 3
    SEVERE = 4

def csv_to_map(filename):
    df = pd.read_csv(
        filename,
        skiprows=1,
        names=[
            "farm_id",
            "region",
            "crop_type",
            "soil_moisture_%",
            "soil_pH",
            "temperature_C",
            "rainfall_mm",
            "humidity_%",
            "sunlight_hours",
            "irrigation_type",
            "fertilizer_type",
            "pesticide_usage_ml",
            "sowing_date",
            "harvest_date",
            "total_days",
            "yield_kg_per_hectare",
            "sensor_id",
            "timestamp",
            "latitude",
            "longitude",
            "NDVI_index",
            "crop_disease_status"
        ],
        parse_dates=["sowing_date", "harvest_date"]
    )

    # --- Drop useless columns ---
    df = df.drop(columns=[
        "farm_id", "region", "sensor_id",
        "timestamp", "latitude", "longitude"
    ])

    # --- Enum mappings ---
    crop_map = {e.name: e.value for e in CropType}
    irrigation_map = {e.name: e.value for e in IrrigationType}
    fertilizer_map = {e.name: e.value for e in FertilizerType}
    disease_map = {e.name: e.value for e in CropDiseaseStatus}

    # Normalize strings BEFORE mapping
    for col in ["crop_type", "irrigation_type", "fertilizer_type", "crop_disease_status"]:
        df[col] = df[col].astype(str).str.strip().str.upper()

    # Apply mappings
    df["crop_type"] = df["crop_type"].map(crop_map)
    df["irrigation_type"] = df["irrigation_type"].map(irrigation_map)
    df["fertilizer_type"] = df["fertilizer_type"].map(fertilizer_map)
    df["crop_disease_status"] = df["crop_disease_status"].map(disease_map)

    # --- Date feature engineering (CRITICAL) ---
    df["sowing_month"] = df["sowing_date"].dt.month
    df["harvest_month"] = df["harvest_date"].dt.month

    # Drop raw date columns
    df = df.drop(columns=["sowing_date", "harvest_date"])

    # --- Convert everything to numeric ---
    df = df.apply(pd.to_numeric, errors="coerce")

    # --- Drop bad rows ---
    df = df.dropna()

    # --- Final safety: ensure float32 (TensorFlow friendly) ---
    df = df.astype("float32")

    return df

# --- Prepare tensors ---
crops_yield_train = csv_to_map("data/train.csv")
crops_yield_test = csv_to_map("data/test.csv")  # Note: probably should be test.csv?

# Setup labels
crops_yield_features = crops_yield_train.copy()
crops_yield_labels = crops_yield_features.pop("yield_kg_per_hectare")

crops_yield_features_test = crops_yield_test.copy()
crops_yield_labels_test = crops_yield_features_test.pop("yield_kg_per_hectare")

# --- Convert to NumPy arrays ---
crops_yield_features = np.array(crops_yield_features)
crops_yield_labels = np.array(crops_yield_labels)
crops_yield_features_test = np.array(crops_yield_features_test)
crops_yield_labels_test = np.array(crops_yield_labels_test)

# --- Standardize features ---
feature_mean = crops_yield_features.mean(axis=0)
feature_std = crops_yield_features.std(axis=0)

crops_yield_features_scaled = (crops_yield_features - feature_mean) / feature_std
crops_yield_features_test_scaled = (crops_yield_features_test - feature_mean) / feature_std

# --- Standardize labels ---
label_mean = crops_yield_labels.mean()
label_std = crops_yield_labels.std()

crops_yield_labels_scaled = (crops_yield_labels - label_mean) / label_std
crops_yield_labels_test_scaled = (crops_yield_labels_test - label_mean) / label_std

# --- Save mean/std for later inference ---
np.save("models/feature_mean.npy", feature_mean)
np.save("models/feature_std.npy", feature_std)
np.save("models/label_mean.npy", label_mean)
np.save("models/label_std.npy", label_std)

# --- Setup model ---
num_features = crops_yield_features.shape[1]

crops_yield_model = tf.keras.Sequential([
    layers.Dense(128, activation='relu', input_shape=(num_features,)),
    layers.Dense(64, activation='relu'),
    layers.Dense(1)
])

# Compile
crops_yield_model.compile(
    loss=tf.keras.losses.MeanSquaredError(),
    optimizer=tf.keras.optimizers.Adam()
)

# Train the model
crops_yield_model.fit(
    crops_yield_features_scaled,
    crops_yield_labels_scaled,
    epochs=10,
    verbose=2
)

# Evaluate
crops_yield_model.evaluate(crops_yield_features_test_scaled, crops_yield_labels_test_scaled, verbose=2)

# Show architecture
crops_yield_model.summary()

# Save the model
crops_yield_model.save('models/argon.keras')
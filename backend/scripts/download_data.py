from datasets import load_dataset
import pandas as pd

# Pull the dataset directly from Hugging Face
dataset = load_dataset("harishnair04/mtsamples", split="train")

# Convert to a Pandas DataFrame
df_mtsamples = dataset.to_pandas()

# View the medical specialty and the raw clinical note
print(df_mtsamples[['medical_specialty', 'transcription']].head())
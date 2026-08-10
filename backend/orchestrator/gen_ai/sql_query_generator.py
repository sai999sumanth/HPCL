import re
import pickle
import random
import pathlib
import numpy as np
import pandas as pd
from datetime import datetime, timezone

df = pd.read_csv(f'{pathlib.Path(__file__).parent.resolve()}/oil_gas_industry_500_queries.csv')

# Create a simple mapping from prompts to queries
prompt_to_query = dict(zip(df['Prompt'], df['Query']))
# Create a vocabulary from the prompts
all_words = set()
for prompt in df['Prompt']:
    words = prompt.lower().split()
    all_words.update(words)

# Create word to index mapping
word_to_idx = {word: i for i, word in enumerate(all_words)}
idx_to_word = {i: word for word, i in word_to_idx.items()}

# Create a simple embedding matrix (simulated)
embedding_dim = 100
embedding_matrix = np.random.randn(len(word_to_idx), embedding_dim)


def extract_parameters(query):
    """Extract parameters from the natural language query"""
    params = {}
    
    # Extract company name
    companies = ['IOCL', 'BPCL', 'HPCL']
    for company in companies:
        if company in query:
            params['COMPANY'] = company
            break
    
    # Extract SBU
    sbus = ['I&C', 'RETAIL', 'LPG', 'AVIATION', 'LUBES', 'PETCHEM', 'GAS']
    for sbu in sbus:
        if sbu.lower() in query.lower():
            params['SBU'] = sbu
            break
    
    # Extract year
    year_match = re.search(r'(\d{4}-\d{4})', query)
    if year_match:
        params['YEAR'] = year_match.group(1)
    else:
        params['YEAR'] = '2024-2025'  # Default to current year
    
    return params


def nl_to_sql(natural_language_query, model_path):
    # Load the model
    with open(model_path, 'rb') as f:
        pipeline = pickle.load(f)
    
    # Predict the SQL template
    template = pipeline.predict([natural_language_query])[0]
    
    # Extract parameters from the query
    params = extract_parameters(natural_language_query)
    
    # Replace placeholders with actual values
    sql_query = template
    for param, value in params.items():
        sql_query = sql_query.replace(f"'{param}'", f"'{value}'")
    
    return sql_query


# Create a simple model that can "generate" SQL queries
class SimpleQueryGenerator:
    def __init__(self, prompt_to_query, word_to_idx, idx_to_word, embedding_matrix):
        self.prompt_to_query = prompt_to_query
        self.word_to_idx = word_to_idx
        self.idx_to_word = idx_to_word
        self.embedding_matrix = embedding_matrix
        self.categories = df['Category'].unique().tolist()

        # Create category-specific templates
        self.category_templates = {}
        for category in self.categories:
            category_queries = df[df['Category'] == category]['Query'].tolist()
            if category_queries:
                self.category_templates[category] = random.sample(category_queries, min(5, len(category_queries)))

    def generate_query(self, prompt):
        # Check if we have an exact match
        if prompt in self.prompt_to_query:
            return self.prompt_to_query[prompt]

        # Otherwise, find the most similar prompt based on word overlap
        words = prompt.lower().split()
        best_match = None
        best_score = 0

        for existing_prompt in self.prompt_to_query.keys():
            existing_words = existing_prompt.lower().split()
            common_words = set(words).intersection(existing_words)
            score = len(common_words) / max(len(words), len(existing_words))

            if score > best_score:
                best_score = score
                best_match = existing_prompt

        if best_score > 0.5:  # Threshold for similarity
            return self.prompt_to_query[best_match]

        # If no good match, generate a query based on category detection
        for category in self.categories:
            if category.lower() in prompt.lower():
                if category in self.category_templates:
                    template = random.choice(self.category_templates[category])
                    return self._customize_template(template, prompt)

        # Default fallback
        random_template = random.choice(df['Query'].tolist())
        return self._customize_template(random_template, prompt)

    def _customize_template(self, template, prompt):
        # Simple customization - replace some placeholders based on prompt
        words = prompt.lower().split()

        # Look for potential field names in the prompt
        field_candidates = ['comname', 'region_name', 'statename', 'productname', 'month_name', 'fiscal_year']
        detected_fields = []

        for field in field_candidates:
            if field.lower() in words:
                detected_fields.append(field)

        # If we found fields, use them to customize the template
        if detected_fields:
            for field in detected_fields:
                # Replace a random field in the template with the detected field
                for replace_field in field_candidates:
                    if replace_field in template and replace_field != field:
                        template = template.replace(replace_field, field, 1)
                        break

        return template

    def get_metadata(self):
        return {
            'model_name': 'SQL Query Generator',
            'version': '1.0',
            'vocabulary_size': len(self.word_to_idx),
            'embedding_dim': self.embedding_matrix.shape[1],
            'categories': self.categories,
            'num_templates': sum(len(templates) for templates in self.category_templates.values()),
            'created_at': datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        }


def generate_sql_query(prompt):
    query_generator = SimpleQueryGenerator(prompt_to_query, word_to_idx, idx_to_word, embedding_matrix)
    sql_query = query_generator.generate_query(prompt)
    return sql_query
